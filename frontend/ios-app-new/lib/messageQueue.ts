import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMessageToCache, removeMessageFromCache, cacheMessages, getCachedMessages } from './userCache';

// ============ MESSAGE QUEUE FOR OFFLINE/OPTIMISTIC UPDATES ============

export type PendingMessage = {
    tempId: string;
    peerId: string;
    subgridId: string;
    body: string;
    kind: string;
    attachments: any[];
    createdAt: string;
    status: 'pending' | 'sending' | 'sent' | 'failed';
    retryCount: number;
    error?: string;
};

const QUEUE_KEY = 'gryd_message_queue';
const DRAFTS_KEY = 'gryd_dm_drafts';
const MAX_RETRIES = 3;

// In-memory queue for fast access
let messageQueue: PendingMessage[] = [];
let draftsCache: Record<string, string> = {};
let queueLoaded = false;

// Listeners for UI updates
type QueueListener = (queue: PendingMessage[]) => void;
const queueListeners: Set<QueueListener> = new Set();

export const subscribeToQueue = (listener: QueueListener): (() => void) => {
    queueListeners.add(listener);
    return () => queueListeners.delete(listener);
};

const notifyListeners = () => {
    queueListeners.forEach(listener => listener([...messageQueue]));
};

// Generate temporary ID for optimistic updates
export const generateTempId = (): string => {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Check if an ID is a temporary ID
export const isTempId = (id: string): boolean => {
    return id.startsWith('temp_');
};

// Load queue from storage
export const loadMessageQueue = async (): Promise<void> => {
    if (queueLoaded) return;
    try {
        const [queueData, draftsData] = await Promise.all([
            AsyncStorage.getItem(QUEUE_KEY),
            AsyncStorage.getItem(DRAFTS_KEY),
        ]);

        if (queueData) {
            messageQueue = JSON.parse(queueData);
        }
        if (draftsData) {
            draftsCache = JSON.parse(draftsData);
        }
        queueLoaded = true;
    } catch {
        queueLoaded = true;
    }
};

// Save queue to storage (debounced)
let saveTimeout: NodeJS.Timeout | null = null;
const saveQueue = (): void => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(messageQueue));
        } catch {
            // Silently fail - queue persistence is best-effort
        }
    }, 500);
};

// ============ OPTIMISTIC MESSAGE OPERATIONS ============

/**
 * Create an optimistic message that shows immediately in UI
 * Returns the temp message object to display while sending
 */
export const createOptimisticMessage = (
    peerId: string,
    subgridId: string,
    body: string,
    currentUserId: string,
    attachments: any[] = [],
    kind: string = 'text'
): { tempMessage: any; pendingMessage: PendingMessage } => {
    const tempId = generateTempId();
    const now = new Date().toISOString();

    // Create the display message (what shows in UI immediately)
    const tempMessage = {
        _id: tempId,
        senderId: currentUserId,
        recipientId: peerId,
        body,
        kind,
        attachments,
        createdAt: now,
        _isPending: true, // Flag for UI to show pending state
        _status: 'sending' as const,
    };

    // Create the queue entry for retry logic
    const pendingMessage: PendingMessage = {
        tempId,
        peerId,
        subgridId,
        body,
        kind,
        attachments,
        createdAt: now,
        status: 'pending',
        retryCount: 0,
    };

    // Add to queue
    messageQueue.push(pendingMessage);
    saveQueue();
    notifyListeners();

    return { tempMessage, pendingMessage };
};

/**
 * Mark a message as successfully sent
 * Replaces temp ID with real ID
 */
export const markMessageSent = (tempId: string, realMessage: any): void => {
    const idx = messageQueue.findIndex(m => m.tempId === tempId);
    if (idx >= 0) {
        messageQueue.splice(idx, 1);
        saveQueue();
        notifyListeners();
    }
};

/**
 * Mark a message as failed
 * Keeps in queue for retry
 */
export const markMessageFailed = (tempId: string, error: string): void => {
    const msg = messageQueue.find(m => m.tempId === tempId);
    if (msg) {
        msg.status = 'failed';
        msg.error = error;
        msg.retryCount++;
        saveQueue();
        notifyListeners();
    }
};

/**
 * Retry a failed message
 */
export const retryMessage = (tempId: string): PendingMessage | null => {
    const msg = messageQueue.find(m => m.tempId === tempId);
    if (msg && msg.retryCount < MAX_RETRIES) {
        msg.status = 'sending';
        msg.error = undefined;
        saveQueue();
        notifyListeners();
        return msg;
    }
    return null;
};

/**
 * Remove a message from queue (cancel send)
 */
export const removeFromQueue = (tempId: string): void => {
    const idx = messageQueue.findIndex(m => m.tempId === tempId);
    if (idx >= 0) {
        messageQueue.splice(idx, 1);
        saveQueue();
        notifyListeners();
    }
};

/**
 * Get all pending messages for a conversation
 */
export const getPendingMessages = (peerId: string): PendingMessage[] => {
    return messageQueue.filter(m => m.peerId === peerId);
};

/**
 * Get all failed messages
 */
export const getFailedMessages = (): PendingMessage[] => {
    return messageQueue.filter(m => m.status === 'failed');
};

// ============ DRAFT PERSISTENCE ============

/**
 * Save a draft message for a conversation
 */
export const saveDraft = (peerId: string, text: string): void => {
    if (text.trim()) {
        draftsCache[peerId] = text;
    } else {
        delete draftsCache[peerId];
    }
    // Debounced save to storage
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(draftsCache));
        } catch {
            // Silently fail - draft persistence is best-effort
        }
    }, 1000);
};

/**
 * Get a saved draft for a conversation
 */
export const getDraft = (peerId: string): string => {
    return draftsCache[peerId] || '';
};

/**
 * Clear a draft after sending
 */
export const clearDraft = (peerId: string): void => {
    delete draftsCache[peerId];
    AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(draftsCache)).catch(() => {});
};

// Initialize on module load
loadMessageQueue();
