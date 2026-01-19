
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    useWindowDimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import {
    Search,
    Plus,
    Calendar as CalendarIcon,
    ChevronDown,
    ArrowUpDown,
    Trash,
    X,
    Mail,
    Globe,
    RefreshCw,
    Pencil,
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type CalendarEvent = {
    _id: string;
    title?: string;
    location?: string;
    notes?: string;
    startAt?: string;
    endAt?: string;
    status?: 'scheduled' | 'completed' | 'canceled';
    provider?: 'local' | 'google';
};

type Connection = {
    _id: string;
    provider: string;
    email?: string;
    calendarId?: string;
};

const CALENDAR_TABS = [
    { key: 'all', label: 'All Meetings', status: null },
    { key: 'completed', label: 'Completed Meetings', status: 'completed' },
    { key: 'canceled', label: 'Canceled Meetings', status: 'canceled' },
];

const VIEW_MODES = ['Day', 'Week', 'Month'] as const;
const MONTH_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = [
    { label: '8 AM', hour: 8 },
    { label: '10 AM', hour: 10 },
    { label: '12 PM', hour: 12 },
    { label: '2 PM', hour: 14 },
    { label: '4 PM', hour: 16 },
    { label: '6 PM', hour: 18 },
];

const STATUS_OPTIONS = [
    { value: 'scheduled', label: 'Scheduled', color: '#DBEAFE', text: '#1D4ED8' },
    { value: 'completed', label: 'Completed', color: '#DCFCE7', text: '#166534' },
    { value: 'canceled', label: 'Canceled', color: '#FEE2E2', text: '#B91C1C' },
];
const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const toDateInput = (value?: string) => {
    const date = parseDate(value);
    if (!date) return '';
    return formatDateKey(date);
};

const toTimeInput = (value?: string) => {
    const date = parseDate(value);
    if (!date) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const buildDateTime = (dateValue: string, timeValue: string) => {
    if (!dateValue) return null;
    const time = timeValue || '09:00';
    const date = new Date(`${dateValue}T${time}:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const buildMonthGrid = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startDay; i += 1) {
        const day = prevMonthDays - startDay + i + 1;
        cells.push({ date: new Date(year, month - 1, day), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (cells.length < 42) {
        const nextDay = cells.length - (startDay + daysInMonth) + 1;
        cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    }
    return cells;
};

const formatMonthTitle = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const CalendarScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const modalWidth = Math.min(width - 32, 520);

    const [tenantId, setTenantId] = useState(getTenantId());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState(CALENDAR_TABS[0].key);
    const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('Month');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [connectModal, setConnectModal] = useState<'google' | 'outlook' | null>(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        location: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        status: 'scheduled' as 'scheduled' | 'completed' | 'canceled',
        notes: '',
        syncToGoogle: false,
    });

    const googleConnection = useMemo(
        () => connections.find((connection) => connection.provider === 'google') || null,
        [connections]
    );

    useEffect(() => {
        let isActive = true;
        resolveTenantId()
            .then((id) => {
                if (isActive) {
                    setTenantId(id || '');
                }
            })
            .catch((err) => {
                if (isActive) {
                    setError(err.message || 'Failed to resolve tenant.');
                }
            });
        return () => {
            isActive = false;
        };
    }, []);

    const loadEvents = async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(`/calendar/tenants/${tenantId}/events`);
            setEvents(res?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load events.');
        } finally {
            setLoading(false);
        }
    };

    const loadConnections = async () => {
        if (!tenantId) return;
        try {
            const res = await apiFetch(`/calendar/tenants/${tenantId}/connections`);
            setConnections(res?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load calendar connections.');
        }
    };

    useEffect(() => {
        loadEvents();
        loadConnections();
    }, [tenantId]);

    useEffect(() => {
        const handler = ({ url }: { url: string }) => {
            if (!url) return;
            const parsed = Linking.parse(url);
            const provider = parsed.queryParams?.provider;
            if (String(parsed.path || '').includes('calendar/oauth') && provider === 'google') {
                loadConnections();
                loadEvents();
                setConnectModal(null);
            }
        };
        const subscription = Linking.addEventListener('url', handler);
        return () => subscription.remove();
    }, [tenantId]);

    const filteredEvents = useMemo(() => {
        let list = [...events];
        const active = CALENDAR_TABS.find((tab) => tab.key === activeTab);
        if (active?.status) {
            list = list.filter((event) => event.status === active.status);
        }
        if (query) {
            const lowered = query.toLowerCase();
            list = list.filter((event) =>
                [event.title, event.location, event.notes]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(lowered))
            );
        }
        list.sort((a, b) => {
            const startA = parseDate(a.startAt)?.getTime() || 0;
            const startB = parseDate(b.startAt)?.getTime() || 0;
            return sortDir === 'asc' ? startA - startB : startB - startA;
        });
        return list;
    }, [events, activeTab, query, sortDir]);

    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        filteredEvents.forEach((event) => {
            const date = parseDate(event.startAt);
            if (!date) return;
            const key = formatDateKey(date);
            if (!map[key]) {
                map[key] = [];
            }
            map[key].push(event);
        });
        Object.values(map).forEach((list) => {
            list.sort((a, b) => {
                const startA = parseDate(a.startAt)?.getTime() || 0;
                const startB = parseDate(b.startAt)?.getTime() || 0;
                return startA - startB;
            });
        });
        return map;
    }, [filteredEvents]);

    const selectedDateKey = formatDateKey(selectedDate);
    const selectedEvents = eventsByDate[selectedDateKey] || [];
    const openCreate = (date?: Date) => {
        const baseDate = date || new Date();
        const dateKey = formatDateKey(baseDate);
        setActiveEvent(null);
        setFormData({
            title: '',
            location: '',
            startDate: dateKey,
            startTime: '09:00',
            endDate: dateKey,
            endTime: '10:00',
            status: 'scheduled',
            notes: '',
            syncToGoogle: Boolean(googleConnection),
        });
        setEventModalOpen(true);
    };

    const openEdit = (event: CalendarEvent) => {
        setActiveEvent(event);
        setFormData({
            title: event.title || '',
            location: event.location || '',
            startDate: toDateInput(event.startAt),
            startTime: toTimeInput(event.startAt) || '09:00',
            endDate: toDateInput(event.endAt),
            endTime: toTimeInput(event.endAt) || '10:00',
            status: event.status || 'scheduled',
            notes: event.notes || '',
            syncToGoogle: event.provider === 'google',
        });
        setEventModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setEventModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        if (!formData.title.trim()) {
            setError('Event title is required.');
            return;
        }

        const startAt = buildDateTime(formData.startDate, formData.startTime);
        const endAt = buildDateTime(formData.endDate, formData.endTime);
        if (!startAt || !endAt) {
            setError('Start and end date/time are required.');
            return;
        }

        const payload: any = {
            title: formData.title.trim(),
            location: formData.location.trim(),
            notes: formData.notes.trim(),
            startAt,
            endAt,
            status: formData.status,
        };

        if (formData.syncToGoogle && googleConnection && !activeEvent?._id) {
            payload.syncProvider = 'google';
        }

        setSaving(true);
        setError('');
        try {
            if (activeEvent?._id) {
                const res = await apiFetch(`/calendar/tenants/${tenantId}/events/${activeEvent._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setEvents((prev) => prev.map((item) => (item._id === updated?._id ? updated : item)));
            } else {
                const res = await apiFetch(`/calendar/tenants/${tenantId}/events`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const created = res?.data;
                if (created) {
                    setEvents((prev) => [...prev, created]);
                }
            }
            setEventModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save event.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (event: CalendarEvent) => {
        if (!tenantId || !event._id) return;
        Alert.alert('Delete event', `Delete "${event.title || 'event'}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setError('');
                    try {
                        await apiFetch(`/calendar/tenants/${tenantId}/events/${event._id}`, { method: 'DELETE' });
                        setEvents((prev) => prev.filter((item) => item._id !== event._id));
                    } catch (err: any) {
                        setError(err.message || 'Failed to delete event.');
                    }
                },
            },
        ]);
    };
    const handleConnectGoogle = async () => {
        if (!tenantId) return;
        setError('');
        try {
            const res = await apiFetch(`/calendar/tenants/${tenantId}/google/connect`, { method: 'POST' });
            const authUrl = res?.data?.authUrl;
            if (authUrl) {
                await Linking.openURL(authUrl);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start Google connection.');
        }
    };

    const handleSyncGoogle = async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            await apiFetch(`/calendar/tenants/${tenantId}/google/sync`, { method: 'POST' });
            await loadEvents();
        } catch (err: any) {
            setError(err.message || 'Failed to sync Google Calendar.');
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnectGoogle = async () => {
        if (!tenantId) return;
        Alert.alert('Disconnect Google', 'Disconnect Google Calendar?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiFetch(`/calendar/tenants/${tenantId}/google/disconnect`, { method: 'POST' });
                        await loadConnections();
                    } catch (err: any) {
                        setError(err.message || 'Failed to disconnect Google Calendar.');
                    }
                },
            },
        ]);
    };

    const handleClearCanceled = () => {
        if (!tenantId) return;
        const canceled = events.filter((event) => event.status === 'canceled');
        if (canceled.length === 0) {
            Alert.alert('Nothing to clear', 'No canceled meetings found.');
            return;
        }
        Alert.alert('Clear canceled meetings', `Delete ${canceled.length} canceled meetings?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        for (const event of canceled) {
                            await apiFetch(`/calendar/tenants/${tenantId}/events/${event._id}`, { method: 'DELETE' });
                        }
                        setEvents((prev) => prev.filter((item) => item.status !== 'canceled'));
                    } catch (err: any) {
                        setError(err.message || 'Failed to clear canceled meetings.');
                    }
                },
            },
        ]);
    };

    const renderMonthView = () => {
        const grid = buildMonthGrid(currentMonth);
        return (
            <View style={styles.calendarCard}>
                <View style={styles.calendarHeaderRow}>
                    <TouchableOpacity
                        style={styles.calendarTitleRow}
                        onPress={() => {
                            const now = new Date();
                            setCurrentMonth(now);
                            setSelectedDate(now);
                        }}
                    >
                        <Text style={styles.calendarTitle}>{formatMonthTitle(currentMonth)}</Text>
                        <ChevronDown size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <View style={styles.viewToggle}>
                        {VIEW_MODES.map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode(mode)}
                            >
                                <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
                                    {mode}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={styles.monthHeader}>
                    {MONTH_DAYS.map((day) => (
                        <Text key={day} style={styles.monthHeaderText}>{day}</Text>
                    ))}
                </View>
                <View style={styles.monthGrid}>
                    {grid.map((cell) => {
                        const key = formatDateKey(cell.date);
                        const dayEvents = eventsByDate[key] || [];
                        const isSelected = key === selectedDateKey;
                        return (
                            <TouchableOpacity
                                key={key}
                                style={[styles.monthCell, isSelected && styles.monthCellSelected]}
                                onPress={() => setSelectedDate(cell.date)}
                            >
                                <Text style={[styles.monthDate, !cell.inMonth && styles.monthDateMuted]}>
                                    {cell.date.getDate()}
                                </Text>
                                {dayEvents.slice(0, 2).map((event) => {
                                    const status = STATUS_OPTIONS.find((option) => option.value === event.status);
                                    return (
                                        <View
                                            key={event._id}
                                            style={[styles.monthEvent, { backgroundColor: status?.color || '#E5E7EB' }]}
                                        >
                                            <Text style={styles.monthEventText} numberOfLines={1}>
                                                {event.title || 'Untitled'}
                                            </Text>
                                        </View>
                                    );
                                })}
                                {dayEvents.length > 2 ? (
                                    <Text style={styles.moreEventsText}>+{dayEvents.length - 2} more</Text>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.dayEventsPanel}>
                    <View style={styles.dayEventsHeader}>
                        <Text style={styles.dayEventsTitle}>Events on {selectedDate.toLocaleDateString()}</Text>
                        <TouchableOpacity style={styles.inlineCreateBtn} onPress={() => openCreate(selectedDate)}>
                            <Plus size={14} color="#111827" />
                            <Text style={styles.inlineCreateText}>Add Event</Text>
                        </TouchableOpacity>
                    </View>
                    {selectedEvents.length === 0 ? (
                        <Text style={styles.helperText}>No meetings scheduled for this day.</Text>
                    ) : (
                        <View style={styles.eventList}>
                            {selectedEvents.map((event) => {
                                const status = STATUS_OPTIONS.find((option) => option.value === event.status);
                                return (
                                    <View key={event._id} style={styles.eventCard}>
                                        <View style={styles.eventInfo}>
                                            <Text style={styles.eventTitle}>{event.title || 'Untitled Meeting'}</Text>
                                            <Text style={styles.eventMeta}>
                                                {toDateInput(event.startAt)} {toTimeInput(event.startAt)} - {toTimeInput(event.endAt)}
                                            </Text>
                                            {event.location ? (
                                                <Text style={styles.eventMeta}>{event.location}</Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.eventActions}>
                                            {status ? (
                                                <View style={[styles.statusBadge, { backgroundColor: status.color }]}
                                                >
                                                    <Text style={[styles.statusBadgeText, { color: status.text }]}>{status.label}</Text>
                                                </View>
                                            ) : null}
                                            <TouchableOpacity onPress={() => openEdit(event)}>
                                                <Pencil size={14} color="#6B7280" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(event)}>
                                                <Trash size={14} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>
        );
    };
    const renderWeekView = () => {
        const baseDate = new Date(selectedDate);
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() - baseDate.getDay());
        const days = viewMode === 'Day'
            ? [{ label: 'Today', date: baseDate }]
            : Array.from({ length: 7 }, (_, index) => {
                const day = new Date(start);
                day.setDate(start.getDate() + index);
                return { label: MONTH_DAYS[day.getDay()], date: day };
            });

        return (
            <View style={styles.calendarCard}>
                <View style={styles.calendarHeaderRow}>
                    <TouchableOpacity
                        style={styles.calendarTitleRow}
                        onPress={() => {
                            const now = new Date();
                            setCurrentMonth(now);
                            setSelectedDate(now);
                        }}
                    >
                        <Text style={styles.calendarTitle}>{formatMonthTitle(currentMonth)}</Text>
                        <ChevronDown size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <View style={styles.viewToggle}>
                        {VIEW_MODES.map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode(mode)}
                            >
                                <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
                                    {mode}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={styles.weekHeader}>
                    <View style={styles.weekTimeSpacer} />
                    {days.map((day) => (
                        <Text key={day.label} style={styles.weekHeaderText}>{day.label}</Text>
                    ))}
                </View>
                <ScrollView style={styles.weekBody} showsVerticalScrollIndicator={false}>
                    {TIME_SLOTS.map((time) => (
                        <View key={time.label} style={styles.weekRow}>
                            <Text style={styles.weekTime}>{time.label}</Text>
                            {days.map((day) => {
                                const key = formatDateKey(day.date);
                                const dayEvents = eventsByDate[key] || [];
                                const slotEvent = dayEvents.find((event) => {
                                    const eventDate = parseDate(event.startAt);
                                    return eventDate && eventDate.getHours() === time.hour;
                                });
                                const status = STATUS_OPTIONS.find((option) => option.value === slotEvent?.status);
                                return (
                                    <View key={`${day.label}-${time.label}`} style={styles.weekCell}>
                                        {slotEvent ? (
                                            <TouchableOpacity
                                                style={[styles.weekEvent, { backgroundColor: status?.color || '#E5E7EB' }]}
                                                onPress={() => openEdit(slotEvent)}
                                            >
                                                <Text style={styles.weekEventText} numberOfLines={1}>
                                                    {slotEvent.title || 'Meeting'}
                                                </Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </ScrollView>
            </View>
        );
    };

    const renderConnectModal = () => {
        if (!connectModal) return null;
        const isGoogle = connectModal === 'google';
        const title = isGoogle ? 'Connect your Google Account' : 'Connect your Outlook 365 Inbox';
        const action = isGoogle ? 'Accept and connect to Google' : 'Accept and connect to Outlook 365';

        return (
            <Modal transparent animationType="fade" visible onRequestClose={() => setConnectModal(null)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalDialog, { width: modalWidth }]}>
                        <View style={styles.dialogHeader}>
                            <Text style={styles.dialogTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setConnectModal(null)}>
                                <X size={18} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dialogContent}>
                            <Text style={styles.dialogParagraph}>
                                When you integrate your {isGoogle ? 'Google' : 'Outlook'} account with the The Gryd platform,
                                The Gryd will be able to access specific data from your calendar and connect it to your CRM.
                            </Text>
                            <Text style={styles.dialogParagraph}>
                                We only use the data to power calendar sync. For more information, see our Privacy Policy.
                            </Text>
                        </View>
                        <View style={styles.dialogFooter}>
                            <TouchableOpacity
                                style={styles.primaryBtn}
                                onPress={() => {
                                    setConnectModal(null);
                                    if (isGoogle) {
                                        handleConnectGoogle();
                                    } else {
                                        Alert.alert('Coming soon', 'Outlook integration is not available yet.');
                                    }
                                }}
                            >
                                <Text style={styles.primaryBtnText}>{action}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setConnectModal(null)}>
                                <Text style={styles.secondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };
    return (
        <ResponsiveLayout>
            <View style={styles.container}>
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <Text style={styles.pageTitle}>Calendar</Text>
                    <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
                        <View style={[styles.searchBar, isCompact && styles.searchBarCompact]}>
                            <Search size={16} color="#9CA3AF" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search meetings..."
                                placeholderTextColor="#9CA3AF"
                                value={query}
                                onChangeText={setQuery}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.newEventBtn, isCompact && styles.newEventBtnCompact]}
                            onPress={() => openCreate(selectedDate)}
                        >
                            <Plus size={16} color="#FFF" />
                            <Text style={styles.newEventText}>New Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.toolbar, isCompact && styles.toolbarCompact]}>
                    <View style={[styles.tabs, isCompact && styles.tabsCompact]}>
                        <CalendarIcon size={18} color="#6B7280" style={{ marginRight: 8 }} />
                        {CALENDAR_TABS.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={[styles.toolActions, isCompact && styles.toolActionsCompact]}>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
                            <ArrowUpDown size={16} color="#374151" />
                            <Text style={styles.toolBtnText}>Sort</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn} onPress={handleClearCanceled}>
                            <Trash size={16} color="#374151" />
                        </TouchableOpacity>
                        {googleConnection ? (
                            <TouchableOpacity style={styles.toolBtn} onPress={handleSyncGoogle}>
                                <RefreshCw size={16} color="#374151" />
                                <Text style={styles.toolBtnText}>Sync Google</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.toolBtn} onPress={() => setConnectModal('google')}>
                                <Globe size={16} color="#374151" />
                                <Text style={styles.toolBtnText}>Connect Google</Text>
                            </TouchableOpacity>
                        )}
                        {googleConnection ? (
                            <TouchableOpacity style={styles.toolBtn} onPress={handleDisconnectGoogle}>
                                <Text style={styles.toolBtnText}>Disconnect</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.toolBtn} onPress={() => setConnectModal('outlook')}>
                            <Mail size={16} color="#374151" />
                            <Text style={styles.toolBtnText}>Outlook</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {loading ? <Text style={styles.helperText}>Loading calendar...</Text> : null}

                <View style={styles.contentArea}>
                    {filteredEvents.length === 0 && !loading ? (
                        <View style={styles.emptyStateCard}>
                            <Text style={styles.emptyTitle}>No Meetings found</Text>
                            <Text style={styles.emptySub}>Create a meeting or connect your calendar to sync.</Text>
                            <View style={styles.emptyActions}>
                                <TouchableOpacity style={styles.connectBtn} onPress={() => setConnectModal('google')}>
                                    <Globe size={16} color="#111827" />
                                    <Text style={styles.connectBtnText}>Connect Google Calendar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.connectBtn} onPress={() => openCreate(selectedDate)}>
                                    <Plus size={16} color="#111827" />
                                    <Text style={styles.connectBtnText}>Create Meeting</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : viewMode === 'Month' ? (
                        renderMonthView()
                    ) : (
                        renderWeekView()
                    )}
                </View>

                {renderConnectModal()}

                <Modal
                    visible={eventModalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={closeModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalDialog, { width: modalWidth }]}>
                            <View style={styles.dialogHeader}>
                                <Text style={styles.dialogTitle}>{activeEvent ? 'Edit Event' : 'New Event'}</Text>
                                <TouchableOpacity onPress={closeModal}>
                                    <X size={18} color="#111827" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.dialogContent}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Title*</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.title}
                                        onChangeText={(title) => setFormData({ ...formData, title })}
                                        placeholder="Meeting with client"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Location</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.location}
                                        onChangeText={(location) => setFormData({ ...formData, location })}
                                        placeholder="Online / Office"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Start</Text>
                                    <View style={styles.dateRow}>
                                        <TextInput
                                            style={[styles.input, styles.dateCell]}
                                            value={formData.startDate}
                                            onChangeText={(startDate) => setFormData({ ...formData, startDate })}
                                            placeholder="YYYY-MM-DD"
                                        />
                                        <TextInput
                                            style={[styles.input, styles.dateCell]}
                                            value={formData.startTime}
                                            onChangeText={(startTime) => setFormData({ ...formData, startTime })}
                                            placeholder="09:00"
                                        />
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>End</Text>
                                    <View style={styles.dateRow}>
                                        <TextInput
                                            style={[styles.input, styles.dateCell]}
                                            value={formData.endDate}
                                            onChangeText={(endDate) => setFormData({ ...formData, endDate })}
                                            placeholder="YYYY-MM-DD"
                                        />
                                        <TextInput
                                            style={[styles.input, styles.dateCell]}
                                            value={formData.endTime}
                                            onChangeText={(endTime) => setFormData({ ...formData, endTime })}
                                            placeholder="10:00"
                                        />
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Status</Text>
                                    <View style={styles.statusRow}>
                                        {STATUS_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[styles.statusChip, formData.status === option.value && styles.statusChipActive]}
                                                onPress={() => setFormData({ ...formData, status: option.value as any })}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusChipText,
                                                        formData.status === option.value && styles.statusChipTextActive,
                                                    ]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Notes</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={formData.notes}
                                        onChangeText={(notes) => setFormData({ ...formData, notes })}
                                        placeholder="Add meeting notes"
                                        multiline
                                    />
                                </View>
                                {googleConnection ? (
                                    <TouchableOpacity
                                        style={[styles.syncToggle, formData.syncToGoogle && styles.syncToggleActive]}
                                        onPress={() => setFormData({ ...formData, syncToGoogle: !formData.syncToGoogle })}
                                    >
                                        <Text
                                            style={[styles.syncToggleText, formData.syncToGoogle && styles.syncToggleTextActive]}
                                        >
                                            Sync to Google Calendar
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </ScrollView>
                            <View style={styles.dialogFooter}>
                                <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
                                    <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={closeModal}>
                                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </ResponsiveLayout>
    );
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FCFCFC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        marginBottom: 20,
    },
    headerCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 16,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    headerRightCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 36,
        width: 200,
        gap: 8,
    },
    searchBarCompact: {
        width: '100%',
    },
    searchInput: {
        fontSize: 14,
        flex: 1,
    },
    newEventBtn: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 8,
        gap: 8,
    },
    newEventBtnCompact: {
        justifyContent: 'center',
    },
    newEventText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    toolbarCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 12,
        paddingHorizontal: 16,
    },
    tabs: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    tabsCompact: {
        rowGap: 8,
    },
    tabBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    tabBtnActive: {
        backgroundColor: '#FFF',
        borderColor: '#E5E7EB',
    },
    tabText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#111827',
        fontWeight: '600',
    },
    toolActions: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    toolActionsCompact: {
        flexWrap: 'wrap',
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        borderRadius: 6,
        gap: 8,
        height: 32,
    },
    toolBtnText: {
        fontSize: 13,
        color: '#374151',
    },
    contentArea: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    helperText: {
        color: '#6B7280',
        fontSize: 12,
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    emptyStateCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: 420,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    emptySub: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        maxWidth: 320,
    },
    emptyActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    connectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    connectBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    calendarCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
    },
    calendarHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },
    calendarTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    calendarTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
        padding: 3,
        gap: 4,
    },
    viewToggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    viewToggleBtnActive: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    viewToggleText: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '600',
    },
    viewToggleTextActive: {
        color: '#111827',
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    monthHeaderText: {
        flex: 1,
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center',
    },
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },
    monthCell: {
        width: '14.285%',
        minHeight: 90,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        padding: 6,
    },
    monthCellSelected: {
        borderColor: '#111827',
        borderWidth: 1,
    },
    monthDate: {
        fontSize: 11,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 6,
    },
    monthDateMuted: {
        color: '#9CA3AF',
    },
    monthEvent: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 4,
    },
    monthEventText: {
        fontSize: 9,
        color: '#111827',
        fontWeight: '600',
    },
    moreEventsText: {
        fontSize: 9,
        color: '#6B7280',
    },
    dayEventsPanel: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 16,
    },
    dayEventsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dayEventsTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    inlineCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    inlineCreateText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#111827',
    },
    eventList: {
        gap: 12,
    },
    eventCard: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F9FAFB',
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    eventMeta: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 4,
    },
    eventActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    weekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 8,
    },
    weekTimeSpacer: {
        width: 60,
    },
    weekHeaderText: {
        flex: 1,
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center',
    },
    weekBody: {
        maxHeight: 360,
    },
    weekRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        minHeight: 60,
    },
    weekTime: {
        width: 60,
        fontSize: 10,
        color: '#6B7280',
        paddingTop: 8,
    },
    weekCell: {
        flex: 1,
        padding: 6,
        borderLeftWidth: 1,
        borderLeftColor: '#F3F4F6',
    },
    weekEvent: {
        borderRadius: 8,
        padding: 6,
    },
    weekEventText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#111827',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalDialog: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        maxHeight: '90%',
    },
    dialogHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dialogTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    dialogContent: {
        padding: 20,
    },
    dialogParagraph: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 18,
        marginBottom: 12,
    },
    dialogFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    primaryBtn: {
        flex: 1,
        backgroundColor: '#111827',
        borderRadius: 999,
        paddingVertical: 10,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: 999,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFF',
    },
    secondaryBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 13,
        color: '#111827',
    },
    textArea: {
        height: 90,
        textAlignVertical: 'top',
        paddingTop: 10,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateCell: {
        flex: 1,
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statusChipActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    statusChipText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    statusChipTextActive: {
        color: '#FFF',
    },
    syncToggle: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 999,
        paddingVertical: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    syncToggleActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    syncToggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    syncToggleTextActive: {
        color: '#FFF',
    },
});

export default CalendarScreen;

