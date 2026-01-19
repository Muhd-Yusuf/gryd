/**
 * Call Signaling Service
 * Manages real-time call notifications and state updates
 * Uses both SSE and WebSocket for maximum compatibility
 * Can be upgraded to Redis for scaling
 */

const EventEmitter = require('events');

// Import websocketService lazily to avoid circular dependency
let websocketService = null;
const getWebSocketService = () => {
    if (!websocketService) {
        websocketService = require('./websocketService');
    }
    return websocketService;
};

class CallSignalingService extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map(); // userId -> Set of response objects (SSE)
        this.pendingCalls = new Map(); // callId -> call data with timeout
        this.CALL_TIMEOUT = 30000; // 30 seconds to answer
    }

    /**
     * Register a user connection for receiving call events
     * @param {string} userId - User ID
     * @param {object} res - Express response object for SSE
     */
    registerConnection(userId, res) {
        if (!this.connections.has(userId)) {
            this.connections.set(userId, new Set());
        }
        this.connections.get(userId).add(res);

        // Setup SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Send initial connection event
        this.sendToConnection(res, 'connected', { userId, timestamp: Date.now() });

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
            this.sendToConnection(res, 'heartbeat', { timestamp: Date.now() });
        }, 15000);

        // Cleanup on connection close
        res.on('close', () => {
            clearInterval(heartbeat);
            this.connections.get(userId)?.delete(res);
            if (this.connections.get(userId)?.size === 0) {
                this.connections.delete(userId);
            }
        });
    }

    /**
     * Send event to a specific SSE connection
     */
    sendToConnection(res, event, data) {
        try {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            console.error('[CallSignaling] Failed to send event:', err.message);
        }
    }

    /**
     * Send event to a specific user (all their connections)
     * Uses both SSE and WebSocket for maximum compatibility
     * @param {string} userId - User ID
     * @param {string} event - Event name
     * @param {object} data - Event data
     */
    sendToUser(userId, event, data) {
        let sseDelivered = false;
        let wsDelivered = false;

        // Send via SSE (legacy)
        const connections = this.connections.get(userId);
        if (connections && connections.size > 0) {
            connections.forEach(res => {
                this.sendToConnection(res, event, data);
            });
            sseDelivered = true;
        }

        // Send via WebSocket (preferred)
        try {
            const ws = getWebSocketService();
            if (ws && ws.isUserOnline(userId)) {
                ws.sendToUser(userId, event, data);
                wsDelivered = true;
            }
        } catch (err) {
            console.error('[CallSignaling] WebSocket send failed:', err.message);
        }

        return sseDelivered || wsDelivered;
    }

    /**
     * Check if a user is online (has active connections via SSE or WebSocket)
     * @param {string} userId - User ID
     * @returns {boolean}
     */
    isUserOnline(userId) {
        // Check SSE connections
        const connections = this.connections.get(userId);
        if (connections && connections.size > 0) {
            return true;
        }

        // Check WebSocket connections
        try {
            const ws = getWebSocketService();
            if (ws && ws.isUserOnline(userId)) {
                return true;
            }
        } catch (err) {
            // Ignore errors
        }

        return false;
    }

    /**
     * Notify callee of incoming call
     * @param {object} callData - Call information
     */
    notifyIncomingCall(callData) {
        const { callId, calleeId, callerId, callerName, callerAvatar, callType, channelName, token, uid, appId } = callData;

        // Log for debugging
        console.log('[CallSignaling] notifyIncomingCall:', {
            callId,
            calleeId,
            callerId,
            callerName,
            callType,
            isCalleeOnline: this.isUserOnline(calleeId),
            sseConnections: this.connections.get(calleeId)?.size || 0,
        });

        // Set timeout for missed call
        const timeout = setTimeout(() => {
            this.handleCallTimeout(callId);
        }, this.CALL_TIMEOUT);

        this.pendingCalls.set(callId, { ...callData, timeout });

        // Send incoming call notification
        const delivered = this.sendToUser(calleeId, 'incoming_call', {
            callId,
            callerId,
            callerName,
            callerAvatar,
            callType,
            channelName,
            token,
            uid,
            appId,
            timestamp: Date.now(),
        });

        console.log('[CallSignaling] Notification delivered:', delivered);

        return delivered;
    }

    /**
     * Handle call timeout (missed call)
     * @param {string} callId - Call ID
     */
    handleCallTimeout(callId) {
        const pendingCall = this.pendingCalls.get(callId);
        if (pendingCall) {
            clearTimeout(pendingCall.timeout);
            this.pendingCalls.delete(callId);

            // Notify caller that call was missed
            this.sendToUser(pendingCall.callerId, 'call_missed', {
                callId,
                calleeId: pendingCall.calleeId,
                timestamp: Date.now(),
            });

            // Emit event for call service to update database
            this.emit('call_timeout', { callId, callData: pendingCall });
        }
    }

    /**
     * Notify caller that call was answered
     * @param {string} callId - Call ID
     * @param {string} calleeId - Callee user ID
     */
    notifyCallAnswered(callId, calleeId) {
        const pendingCall = this.pendingCalls.get(callId);
        if (pendingCall) {
            clearTimeout(pendingCall.timeout);
            this.pendingCalls.delete(callId);

            // Notify caller
            this.sendToUser(pendingCall.callerId, 'call_answered', {
                callId,
                calleeId,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Notify caller that call was declined
     * @param {string} callId - Call ID
     * @param {string} calleeId - Callee user ID
     */
    notifyCallDeclined(callId, calleeId) {
        const pendingCall = this.pendingCalls.get(callId);
        if (pendingCall) {
            clearTimeout(pendingCall.timeout);
            this.pendingCalls.delete(callId);

            // Notify caller
            this.sendToUser(pendingCall.callerId, 'call_declined', {
                callId,
                calleeId,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Notify all participants that call ended
     * @param {string} callId - Call ID
     * @param {string} endedBy - User ID who ended the call
     * @param {Array} participantIds - All participant user IDs
     * @param {string} reason - End reason
     */
    notifyCallEnded(callId, endedBy, participantIds, reason = 'ended') {
        // Clear any pending timeout
        const pendingCall = this.pendingCalls.get(callId);
        if (pendingCall) {
            clearTimeout(pendingCall.timeout);
            this.pendingCalls.delete(callId);
        }

        // Notify all participants except the one who ended it
        participantIds.forEach(userId => {
            if (userId !== endedBy) {
                this.sendToUser(userId, 'call_ended', {
                    callId,
                    endedBy,
                    reason,
                    timestamp: Date.now(),
                });
            }
        });
    }

    /**
     * Notify user is busy
     * @param {string} callId - Call ID
     * @param {string} callerId - Caller user ID
     * @param {string} calleeId - Busy callee user ID
     */
    notifyUserBusy(callId, callerId, calleeId) {
        this.sendToUser(callerId, 'user_busy', {
            callId,
            calleeId,
            timestamp: Date.now(),
        });
    }

    /**
     * Notify participant joined call
     * @param {string} callId - Call ID
     * @param {Array} participantIds - All participant user IDs
     * @param {object} joinedUser - User who joined
     */
    notifyParticipantJoined(callId, participantIds, joinedUser) {
        participantIds.forEach(userId => {
            if (userId !== joinedUser.id) {
                this.sendToUser(userId, 'participant_joined', {
                    callId,
                    user: joinedUser,
                    timestamp: Date.now(),
                });
            }
        });
    }

    /**
     * Notify participant left call
     * @param {string} callId - Call ID
     * @param {Array} participantIds - All participant user IDs
     * @param {string} leftUserId - User who left
     */
    notifyParticipantLeft(callId, participantIds, leftUserId) {
        participantIds.forEach(userId => {
            if (userId !== leftUserId) {
                this.sendToUser(userId, 'participant_left', {
                    callId,
                    userId: leftUserId,
                    timestamp: Date.now(),
                });
            }
        });
    }

    /**
     * Get online status for multiple users
     * @param {Array} userIds - User IDs to check
     * @returns {object} Map of userId -> online status
     */
    getOnlineStatus(userIds) {
        const status = {};
        userIds.forEach(userId => {
            status[userId] = this.isUserOnline(userId);
        });
        return status;
    }

    /**
     * Get connection count for debugging
     */
    getStats() {
        return {
            totalConnections: Array.from(this.connections.values()).reduce((sum, set) => sum + set.size, 0),
            uniqueUsers: this.connections.size,
            pendingCalls: this.pendingCalls.size,
        };
    }
}

// Singleton instance
const callSignalingService = new CallSignalingService();

module.exports = callSignalingService;
