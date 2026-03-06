const { google } = require('googleapis');
const CalendarEvent = require('../models/CalendarEvent');
const CalendarConnection = require('../models/CalendarConnection');

const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];

const buildOAuthClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const encodeState = (payload) => {
    try {
        const json = JSON.stringify(payload || {});
        return Buffer.from(json).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    } catch {
        return '';
    }
};

const decodeState = (state) => {
    if (!state) return null;
    try {
        const normalized = state.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)), '=');
        const json = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
};

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
};

const buildGoogleEventPayload = (event) => {
    return {
        summary: event.title,
        location: event.location || undefined,
        description: event.notes || undefined,
        start: { dateTime: new Date(event.startAt).toISOString() },
        end: { dateTime: new Date(event.endAt).toISOString() },
    };
};

const hydrateOAuthClient = async (connection) => {
    const oauth2Client = buildOAuthClient();
    oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        scope: connection.scope,
        token_type: connection.tokenType,
        expiry_date: connection.expiryDate || undefined,
    });

    const tokenResponse = await oauth2Client.getAccessToken().catch(() => null);
    const credentials = oauth2Client.credentials || {};

    if (tokenResponse?.token && tokenResponse.token !== connection.accessToken) {
        credentials.access_token = tokenResponse.token;
    }

    const update = {};
    if (credentials.access_token && credentials.access_token !== connection.accessToken) {
        update.accessToken = credentials.access_token;
    }
    if (credentials.refresh_token && credentials.refresh_token !== connection.refreshToken) {
        update.refreshToken = credentials.refresh_token;
    }
    if (typeof credentials.expiry_date === 'number' && credentials.expiry_date !== connection.expiryDate) {
        update.expiryDate = credentials.expiry_date;
    }
    if (Object.keys(update).length > 0) {
        await CalendarConnection.findByIdAndUpdate(connection._id, { $set: update });
    }

    return oauth2Client;
};

const normalizeGoogleDates = (event) => {
    const start = event?.start?.dateTime || event?.start?.date;
    const end = event?.end?.dateTime || event?.end?.date;
    if (!start || !end) {
        return { startAt: null, endAt: null };
    }
    let startAt = new Date(start);
    let endAt = new Date(end);
    if (event?.start?.date && !event?.start?.dateTime) {
        startAt = new Date(`${event.start.date}T00:00:00`);
    }
    if (event?.end?.date && !event?.end?.dateTime) {
        endAt = new Date(`${event.end.date}T00:00:00`);
        endAt.setMinutes(endAt.getMinutes() - 1);
    }
    return { startAt, endAt };
};

const mapGoogleStatus = (status) => {
    if (status === 'cancelled') return 'canceled';
    return 'scheduled';
};

exports.listEvents = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { status, from, to, q } = req.query || {};
        const filter = { tenantId };

        if (status) {
            filter.status = status;
        }

        if (from || to) {
            filter.startAt = {};
            if (from) {
                const start = parseDate(from);
                if (start) {
                    filter.startAt.$gte = start;
                }
            }
            if (to) {
                const end = parseDate(to);
                if (end) {
                    filter.startAt.$lte = end;
                }
            }
        }

        if (q) {
            const regex = new RegExp(String(q), 'i');
            filter.$or = [{ title: regex }, { location: regex }, { notes: regex }];
        }

        const events = await CalendarEvent.find(filter).sort({ startAt: 1 });
        return res.status(200).json({ success: true, data: events });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list events' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        const startAt = parseDate(payload.startAt);
        const endAt = parseDate(payload.endAt);

        if (!payload.title || !startAt || !endAt) {
            return res.status(400).json({ message: 'Title, startAt, and endAt are required' });
        }

        const baseEvent = {
            tenantId,
            userId: req.user?.id || null,
            title: payload.title,
            location: payload.location || '',
            notes: payload.notes || '',
            startAt,
            endAt,
            status: payload.status || 'scheduled',
            attendees: payload.attendees || [],
            provider: 'local',
        };

        if (payload.syncProvider === 'google') {
            const connection = await CalendarConnection.findOne({
                tenantId,
                userId: req.user?.id,
                provider: 'google',
            });
            if (connection) {
                const oauth2Client = await hydrateOAuthClient(connection);
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                const response = await calendar.events.insert({
                    calendarId: connection.calendarId || 'primary',
                    requestBody: buildGoogleEventPayload(baseEvent),
                });
                const googleEvent = response.data || {};
                baseEvent.provider = 'google';
                baseEvent.providerEventId = googleEvent.id || null;
                baseEvent.providerCalendarId = connection.calendarId || 'primary';
            }
        }

        const event = await CalendarEvent.create(baseEvent);
        return res.status(201).json({ success: true, data: event });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create event' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { tenantId, eventId } = req.params;
        const payload = req.body || {};
        const event = await CalendarEvent.findOne({ tenantId, _id: eventId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (payload.startAt) {
            const startAt = parseDate(payload.startAt);
            if (!startAt) {
                return res.status(400).json({ message: 'Invalid startAt' });
            }
            payload.startAt = startAt;
        }
        if (payload.endAt) {
            const endAt = parseDate(payload.endAt);
            if (!endAt) {
                return res.status(400).json({ message: 'Invalid endAt' });
            }
            payload.endAt = endAt;
        }

        if (event.provider === 'google' && event.providerEventId) {
            const connection = await CalendarConnection.findOne({
                tenantId,
                userId: event.userId || req.user?.id,
                provider: 'google',
            });
            if (connection) {
                const oauth2Client = await hydrateOAuthClient(connection);
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                await calendar.events.update({
                    calendarId: event.providerCalendarId || connection.calendarId || 'primary',
                    eventId: event.providerEventId,
                    requestBody: buildGoogleEventPayload({
                        title: payload.title ?? event.title,
                        location: payload.location ?? event.location,
                        notes: payload.notes ?? event.notes,
                        startAt: payload.startAt ?? event.startAt,
                        endAt: payload.endAt ?? event.endAt,
                    }),
                });
            }
        }

        const updated = await CalendarEvent.findOneAndUpdate(
            { tenantId, _id: eventId },
            { $set: payload },
            { new: true }
        );
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update event' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { tenantId, eventId } = req.params;
        const event = await CalendarEvent.findOne({ tenantId, _id: eventId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.provider === 'google' && event.providerEventId) {
            const connection = await CalendarConnection.findOne({
                tenantId,
                userId: event.userId || req.user?.id,
                provider: 'google',
            });
            if (connection) {
                const oauth2Client = await hydrateOAuthClient(connection);
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                await calendar.events.delete({
                    calendarId: event.providerCalendarId || connection.calendarId || 'primary',
                    eventId: event.providerEventId,
                });
            }
        }

        await CalendarEvent.findOneAndDelete({ tenantId, _id: eventId });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete event' });
    }
};

exports.listConnections = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const userId = req.user?.id;
        const connections = await CalendarConnection.find({ tenantId, userId }).sort({ createdAt: -1 });
        const safeConnections = connections.map((connection) => ({
            _id: connection._id,
            provider: connection.provider,
            email: connection.email,
            calendarId: connection.calendarId,
            connectedAt: connection.createdAt,
        }));
        return res.status(200).json({ success: true, data: safeConnections });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list connections' });
    }
};

exports.connectGoogle = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const userId = req.user?.id;
        const oauth2Client = buildOAuthClient();
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
            return res.status(400).json({ message: 'Google OAuth is not configured' });
        }

        const state = encodeState({
            tenantId,
            userId,
            ts: Date.now(),
        });

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: GOOGLE_SCOPES,
            state,
        });

        return res.status(200).json({ success: true, data: { authUrl } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create Google auth url' });
    }
};

exports.googleCallback = async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).send('Missing authorization code');
        }

        const payload = decodeState(state);
        if (!payload?.tenantId || !payload?.userId) {
            return res.status(400).send('Invalid state');
        }

        const oauth2Client = buildOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        let email = '';
        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const info = await oauth2.userinfo.get();
            email = info.data?.email || '';
        } catch {
            email = '';
        }

        const update = {
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || '',
            tokenType: tokens.token_type || '',
            scope: tokens.scope || '',
            expiryDate: tokens.expiry_date || null,
            email,
            calendarId: 'primary',
        };

        await CalendarConnection.findOneAndUpdate(
            { tenantId: payload.tenantId, userId: payload.userId, provider: 'google' },
            { $set: update },
            { new: true, upsert: true }
        );

        const redirectScheme = process.env.GOOGLE_CALENDAR_REDIRECT_SCHEME || 'syphor://calendar/oauth';
        return res.redirect(`${redirectScheme}?provider=google&success=1`);
    } catch (error) {
        const redirectScheme = process.env.GOOGLE_CALENDAR_REDIRECT_SCHEME || 'syphor://calendar/oauth';
        return res.redirect(`${redirectScheme}?provider=google&success=0&message=${encodeURIComponent(error.message)}`);
    }
};

exports.syncGoogleCalendar = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const userId = req.user?.id;
        const connection = await CalendarConnection.findOne({ tenantId, userId, provider: 'google' });
        if (!connection) {
            return res.status(400).json({ message: 'Google calendar is not connected' });
        }

        const oauth2Client = await hydrateOAuthClient(connection);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const from = req.body?.from || req.query?.from;
        const to = req.body?.to || req.query?.to;
        const timeMin = parseDate(from)?.toISOString();
        const timeMax = parseDate(to)?.toISOString();

        const response = await calendar.events.list({
            calendarId: connection.calendarId || 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const items = response.data?.items || [];
        let synced = 0;

        for (const item of items) {
            if (!item?.id) continue;
            const { startAt, endAt } = normalizeGoogleDates(item);
            if (!startAt || !endAt) continue;

            const upsert = {
                tenantId,
                userId,
                title: item.summary || 'Untitled Event',
                location: item.location || '',
                notes: item.description || '',
                startAt,
                endAt,
                status: mapGoogleStatus(item.status),
                provider: 'google',
                providerEventId: item.id,
                providerCalendarId: connection.calendarId || 'primary',
            };

            await CalendarEvent.findOneAndUpdate(
                { tenantId, provider: 'google', providerEventId: item.id },
                { $set: upsert },
                { new: true, upsert: true }
            );
            synced += 1;
        }

        return res.status(200).json({ success: true, data: { synced } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to sync Google calendar' });
    }
};

exports.disconnectGoogle = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const userId = req.user?.id;
        await CalendarConnection.findOneAndDelete({ tenantId, userId, provider: 'google' });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to disconnect Google calendar' });
    }
};
