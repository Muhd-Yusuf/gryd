/**
 * Real-Time Call Service (Agora)
 *
 * Features:
 * - Voice calls (1:1 and group)
 * - Video calls (1:1 and group)
 * - Screen sharing
 * - Token generation for secure access
 * - Channel management
 * - Call persistence and history
 * - Real-time signaling
 */

const crypto = require('crypto');
const Call = require('../models/Call');
const User = require('../models/User');
const callSignaling = require('./callSignalingService');

// Try to load agora-token, but don't fail if not installed
let RtcTokenBuilder, RtcRole;
try {
    const agoraToken = require('agora-token');
    RtcTokenBuilder = agoraToken.RtcTokenBuilder;
    RtcRole = agoraToken.RtcRole;
} catch (e) {
    console.warn('agora-token not installed. Call tokens will not be generated.');
}

// Agora configuration
const getAgoraConfig = () => {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId) {
        throw new Error('AGORA_APP_ID is not configured');
    }

    return { appId, appCertificate };
};

/**
 * Generate a unique channel name
 * @param {string} type - Channel type (dm, channel, group)
 * @param {string} id1 - First participant ID or channel ID
 * @param {string} id2 - Second participant ID (for DMs)
 * @returns {string} Channel name
 */
const generateChannelName = (type, id1, id2 = null) => {
    if (type === 'dm' && id2) {
        // Sort IDs to ensure consistent channel name regardless of who initiates
        const sorted = [id1, id2].sort();
        return `dm_${sorted[0]}_${sorted[1]}`;
    }
    if (type === 'channel') {
        return `ch_${id1}`;
    }
    if (type === 'group') {
        return `grp_${id1}`;
    }
    return `call_${id1}_${Date.now()}`;
};

/**
 * Convert string ID to numeric UID for Agora
 * @param {string} userId - String user ID
 * @returns {number} Numeric UID
 */
const stringToUid = (userId) => {
    if (!userId) return 0;
    // Create a hash and take first 8 hex chars, convert to number
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % 2147483647; // Keep within 32-bit int range
};

/**
 * Generate Agora RTC token for joining a channel
 * @param {Object} options - Token options
 * @param {string} options.channelName - Channel name
 * @param {string} options.userId - User ID (will be hashed to UID)
 * @param {string} options.role - User role ('publisher' or 'subscriber')
 * @param {number} options.expirationTimeInSeconds - Token validity (default 3600)
 * @returns {Object} Token and channel info
 */
const generateCallToken = ({
    channelName,
    userId,
    role = 'publisher',
    expirationTimeInSeconds = 3600,
}) => {
    const { appId, appCertificate } = getAgoraConfig();

    // Convert userId to numeric UID (Agora requires numeric UIDs)
    const uid = stringToUid(userId);

    // Calculate privilege expire time
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;

    // Generate token
    let token = null;
    if (appCertificate && RtcTokenBuilder) {
        // Set role
        const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

        token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            rtcRole,
            privilegeExpireTime
        );
    }

    return {
        token,
        channelName,
        uid,
        appId,
        expiresAt: new Date(privilegeExpireTime * 1000).toISOString(),
    };
};

/**
 * Initiate a DM call with persistence and signaling
 * @param {string} callerId - Caller user ID
 * @param {string} calleeId - Callee user ID
 * @param {string} callType - 'audio' or 'video'
 * @param {object} options - Additional options
 * @returns {Promise<Object>} Call session info
 */
const initiateDMCall = async (callerId, calleeId, callType = 'audio', options = {}) => {
    // First, clean up any stale calls for both users
    await Promise.all([
        Call.cleanupStaleCalls(callerId),
        Call.cleanupStaleCalls(calleeId)
    ]);

    // Check if callee is busy
    const isCalleeBusy = await Call.isUserBusy(calleeId);
    if (isCalleeBusy) {
        const callId = crypto.randomBytes(8).toString('hex');
        callSignaling.notifyUserBusy(callId, callerId, calleeId);
        return {
            success: false,
            error: 'user_busy',
            message: 'User is currently in another call',
        };
    }

    // Check if caller is already in a call
    const isCallerBusy = await Call.isUserBusy(callerId);
    if (isCallerBusy) {
        return {
            success: false,
            error: 'already_in_call',
            message: 'You are already in a call',
        };
    }

    const channelName = generateChannelName('dm', callerId, calleeId);
    const callId = crypto.randomBytes(8).toString('hex');

    // Generate tokens for both participants
    const callerToken = generateCallToken({
        channelName,
        userId: callerId,
        role: 'publisher',
    });

    const calleeToken = generateCallToken({
        channelName,
        userId: calleeId,
        role: 'publisher',
    });

    // Get caller info for notification
    let callerName = 'Unknown';
    let callerAvatar = null;
    try {
        const caller = await User.findById(callerId);
        if (caller) {
            callerName = [caller.firstName, caller.lastName].filter(Boolean).join(' ') || caller.email;
            callerAvatar = caller.avatarUrl;
        }
    } catch (err) {
        console.error('Failed to get caller info:', err);
    }

    // Create call record in database
    const call = new Call({
        callId,
        channelName,
        callType,
        callContext: 'dm',
        dmPeers: {
            callerId,
            calleeId,
        },
        tenantId: options.tenantId || undefined,
        subgridId: options.subgridId || undefined,
        participants: [
            {
                userId: callerId,
                agoraUid: callerToken.uid,
                role: 'caller',
                status: 'joined',
                joinedAt: new Date(),
            },
            {
                userId: calleeId,
                agoraUid: calleeToken.uid,
                role: 'callee',
                status: 'ringing',
            },
        ],
        status: 'ringing',
        metadata: {
            appId: callerToken.appId,
        },
    });

    await call.save();

    // Send real-time notification to callee
    const delivered = callSignaling.notifyIncomingCall({
        callId,
        calleeId,
        callerId,
        callerName,
        callerAvatar,
        callType,
        channelName,
        token: calleeToken.token,
        uid: calleeToken.uid,
        appId: calleeToken.appId,
    });

    return {
        success: true,
        callId,
        channelName,
        callType,
        notificationDelivered: delivered,
        caller: {
            userId: callerId,
            ...callerToken,
        },
        callee: {
            userId: calleeId,
            ...calleeToken,
        },
        createdAt: call.initiatedAt.toISOString(),
    };
};

/**
 * Answer an incoming call
 * @param {string} callId - Call ID
 * @param {string} userId - User answering the call
 * @returns {Promise<Object>} Updated call info with token
 */
const answerCall = async (callId, userId) => {
    const call = await Call.findByCallId(callId);
    if (!call) {
        return { success: false, error: 'call_not_found' };
    }

    if (call.status !== 'ringing' && call.status !== 'initiating') {
        return { success: false, error: 'call_not_available', status: call.status };
    }

    // Mark call as answered
    await call.answer(userId);

    // Generate fresh token for the user
    const tokenInfo = generateCallToken({
        channelName: call.channelName,
        userId,
        role: 'publisher',
    });

    // Notify caller that call was answered
    callSignaling.notifyCallAnswered(callId, userId);

    return {
        success: true,
        callId,
        channelName: call.channelName,
        callType: call.callType,
        ...tokenInfo,
    };
};

/**
 * Decline an incoming call
 * @param {string} callId - Call ID
 * @param {string} userId - User declining the call
 * @returns {Promise<Object>} Result
 */
const declineCall = async (callId, userId) => {
    const call = await Call.findByCallId(callId);
    if (!call) {
        return { success: false, error: 'call_not_found' };
    }

    await call.decline(userId);

    // Notify caller
    callSignaling.notifyCallDeclined(callId, userId);

    return { success: true, callId, status: call.status };
};

/**
 * End an active call
 * @param {string} callId - Call ID
 * @param {string} userId - User ending the call
 * @returns {Promise<Object>} Result
 */
const endCall = async (callId, userId) => {
    const call = await Call.findByCallId(callId);
    if (!call) {
        return { success: false, error: 'call_not_found' };
    }

    const endReason = call.status === 'active' ? 'completed' : 'caller_ended';
    await call.end(endReason);

    // Notify all participants
    const participantIds = call.participants.map(p => p.userId.toString());
    callSignaling.notifyCallEnded(callId, userId, participantIds, endReason);

    return {
        success: true,
        callId,
        duration: call.duration,
        endReason,
    };
};

/**
 * Get call by ID with populated user details
 * @param {string} callId - Call ID
 * @param {boolean} populateUsers - Whether to populate user details
 * @returns {Promise<Object>} Call data
 */
const getCall = async (callId, populateUsers = true) => {
    let call = await Call.findByCallId(callId);
    if (!call) {
        return null;
    }

    // Populate user details for participants
    let participantsWithDetails = call.participants;
    if (populateUsers) {
        const userIds = call.participants.map(p => p.userId);
        const users = await User.find({ _id: { $in: userIds } })
            .select('firstName lastName email avatarUrl');

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        participantsWithDetails = call.participants.map(p => {
            const user = userMap.get(p.userId.toString());
            return {
                userId: p.userId,
                agoraUid: p.agoraUid,
                role: p.role,
                status: p.status,
                joinedAt: p.joinedAt,
                leftAt: p.leftAt,
                userDetails: user ? {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
                } : null,
            };
        });
    }

    return {
        callId: call.callId,
        channelName: call.channelName,
        callType: call.callType,
        callContext: call.callContext,
        status: call.status,
        participants: participantsWithDetails,
        initiatedAt: call.initiatedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        duration: call.duration,
    };
};

/**
 * Get call history for a user
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Call history
 */
const getCallHistory = async (userId, options = {}) => {
    return Call.getUserCallHistory(userId, options);
};

/**
 * Get DM call history between two users
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Call history
 */
const getDMCallHistory = async (userId1, userId2, limit = 20) => {
    return Call.getDMCallHistory(userId1, userId2, limit);
};

/**
 * Generate token for joining a channel call
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID
 * @param {string} callType - 'audio' or 'video'
 * @returns {Object} Call session info
 */
const initiateChannelCall = (channelId, userId, callType = 'audio') => {
    const channelName = generateChannelName('channel', channelId);

    const tokenInfo = generateCallToken({
        channelName,
        userId,
        role: 'publisher',
    });

    return {
        channelName,
        channelId,
        callType,
        ...tokenInfo,
    };
};

/**
 * Generate token for joining a group call
 * @param {string} groupId - Group/subgrid ID
 * @param {string} userId - User ID
 * @param {string} callType - 'audio' or 'video'
 * @returns {Object} Call session info
 */
const initiateGroupCall = (groupId, userId, callType = 'audio') => {
    const channelName = generateChannelName('group', groupId);

    const tokenInfo = generateCallToken({
        channelName,
        userId,
        role: 'publisher',
    });

    return {
        channelName,
        groupId,
        callType,
        ...tokenInfo,
    };
};

/**
 * Refresh call token (when token is about to expire)
 * @param {string} channelName - Existing channel name
 * @param {string} userId - User ID
 * @returns {Object} New token info
 */
const refreshCallToken = (channelName, userId) => {
    return generateCallToken({
        channelName,
        userId,
        role: 'publisher',
        expirationTimeInSeconds: 3600,
    });
};

/**
 * Check if Agora is configured
 * @returns {boolean}
 */
const isAgoraConfigured = () => {
    return !!process.env.AGORA_APP_ID;
};

// Handle call timeout events from signaling service
callSignaling.on('call_timeout', async ({ callId }) => {
    try {
        const call = await Call.findByCallId(callId);
        if (call && (call.status === 'ringing' || call.status === 'initiating')) {
            call.status = 'missed';
            call.endedAt = new Date();
            call.endReason = 'missed';
            call.participants.forEach(p => {
                if (p.role === 'callee' && p.status === 'ringing') {
                    p.status = 'missed';
                }
            });
            await call.save();
        }
    } catch (err) {
        console.error('[CallService] Failed to handle call timeout:', err);
    }
});

module.exports = {
    generateCallToken,
    generateChannelName,
    initiateDMCall,
    initiateChannelCall,
    initiateGroupCall,
    answerCall,
    declineCall,
    endCall,
    getCall,
    getCallHistory,
    getDMCallHistory,
    refreshCallToken,
    stringToUid,
    isAgoraConfigured,
};
