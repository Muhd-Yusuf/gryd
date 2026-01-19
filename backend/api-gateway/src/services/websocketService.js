/**
 * WebSocket Service
 * Real-time bidirectional communication using Socket.io
 * Enables instant sync between CU Admin and Members dashboards
 */

const { Server } = require('socket.io');
const EventEmitter = require('events');

class WebSocketService extends EventEmitter {
    constructor() {
        super();
        this.io = null;
        this.userSockets = new Map(); // userId -> Set of socket IDs
        this.socketUsers = new Map(); // socketId -> userId
        this.roomMembers = new Map(); // roomId -> Set of userIds
    }

    /**
     * Initialize Socket.io with HTTP server
     * @param {http.Server} server - HTTP server instance
     * @param {object} corsOptions - CORS configuration
     */
    initialize(server, corsOptions = {}) {
        this.io = new Server(server, {
            cors: {
                origin: corsOptions.origin || '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        this.io.on('connection', (socket) => this.handleConnection(socket));

        console.log('[WebSocket] Service initialized');
        return this.io;
    }

    /**
     * Handle new socket connection
     * @param {Socket} socket - Socket.io socket instance
     */
    handleConnection(socket) {
        console.log(`[WebSocket] New connection: ${socket.id}`);

        // Authenticate user from handshake
        socket.on('authenticate', (data) => this.handleAuthenticate(socket, data));

        // Join specific rooms (subgrids, channels, DMs)
        socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
        socket.on('leave_room', (data) => this.handleLeaveRoom(socket, data));

        // Presence events
        socket.on('presence_update', (data) => this.handlePresenceUpdate(socket, data));

        // Typing indicators
        socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
        socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));

        // Handle disconnection
        socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));

        // Error handling
        socket.on('error', (error) => {
            console.error(`[WebSocket] Socket error (${socket.id}):`, error);
        });
    }

    /**
     * Authenticate user and associate socket with userId
     */
    handleAuthenticate(socket, { userId, tenantId }) {
        if (!userId) {
            socket.emit('auth_error', { message: 'User ID required' });
            return;
        }

        // Store user-socket mapping
        this.socketUsers.set(socket.id, userId);

        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);

        // Join user's personal room for direct notifications
        socket.join(`user:${userId}`);

        // Join tenant room if provided
        if (tenantId) {
            socket.join(`tenant:${tenantId}`);
        }

        socket.emit('authenticated', { userId, socketId: socket.id });
        console.log(`[WebSocket] User ${userId} authenticated on socket ${socket.id}`);

        // Emit user online event
        this.emit('user_online', { userId });
    }

    /**
     * Handle room join (subgrid, channel, or DM)
     */
    handleJoinRoom(socket, { roomType, roomId }) {
        const userId = this.socketUsers.get(socket.id);
        if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const fullRoomId = `${roomType}:${roomId}`;
        socket.join(fullRoomId);

        // Track room membership
        if (!this.roomMembers.has(fullRoomId)) {
            this.roomMembers.set(fullRoomId, new Set());
        }
        this.roomMembers.get(fullRoomId).add(userId);

        socket.emit('room_joined', { roomType, roomId });
        console.log(`[WebSocket] User ${userId} joined room ${fullRoomId}`);
    }

    /**
     * Handle room leave
     */
    handleLeaveRoom(socket, { roomType, roomId }) {
        const userId = this.socketUsers.get(socket.id);
        const fullRoomId = `${roomType}:${roomId}`;

        socket.leave(fullRoomId);

        // Update room membership
        if (this.roomMembers.has(fullRoomId)) {
            this.roomMembers.get(fullRoomId).delete(userId);
        }

        socket.emit('room_left', { roomType, roomId });
    }

    /**
     * Handle presence update
     */
    handlePresenceUpdate(socket, { status, statusMessage }) {
        const userId = this.socketUsers.get(socket.id);
        if (!userId) return;

        // Broadcast to all rooms user is in
        socket.rooms.forEach((room) => {
            if (room !== socket.id) {
                socket.to(room).emit('presence_changed', {
                    userId,
                    status,
                    statusMessage,
                    timestamp: new Date().toISOString(),
                });
            }
        });

        this.emit('presence_update', { userId, status, statusMessage });
    }

    /**
     * Handle typing indicator start
     */
    handleTypingStart(socket, { roomType, roomId }) {
        const userId = this.socketUsers.get(socket.id);
        if (!userId) return;

        const fullRoomId = `${roomType}:${roomId}`;
        socket.to(fullRoomId).emit('user_typing', {
            userId,
            roomType,
            roomId,
            isTyping: true,
        });
    }

    /**
     * Handle typing indicator stop
     */
    handleTypingStop(socket, { roomType, roomId }) {
        const userId = this.socketUsers.get(socket.id);
        if (!userId) return;

        const fullRoomId = `${roomType}:${roomId}`;
        socket.to(fullRoomId).emit('user_typing', {
            userId,
            roomType,
            roomId,
            isTyping: false,
        });
    }

    /**
     * Handle socket disconnection
     */
    handleDisconnect(socket, reason) {
        const userId = this.socketUsers.get(socket.id);
        console.log(`[WebSocket] Disconnected: ${socket.id} (${reason}), user: ${userId || 'unknown'}`);

        if (userId) {
            // Remove socket from user's sockets
            const userSocketSet = this.userSockets.get(userId);
            if (userSocketSet) {
                userSocketSet.delete(socket.id);

                // If user has no more active sockets, they're offline
                if (userSocketSet.size === 0) {
                    this.userSockets.delete(userId);
                    this.emit('user_offline', { userId });

                    // Broadcast offline status to rooms
                    this.broadcastToUserRooms(userId, 'presence_changed', {
                        userId,
                        status: 'offline',
                        timestamp: new Date().toISOString(),
                    });
                }
            }

            // Clean up room memberships
            this.roomMembers.forEach((members, roomId) => {
                members.delete(userId);
            });
        }

        this.socketUsers.delete(socket.id);
    }

    // ==================
    // BROADCAST METHODS
    // ==================

    /**
     * Send event to a specific user (all their connected devices)
     */
    sendToUser(userId, event, data) {
        const roomId = `user:${userId}`;
        this.io.to(roomId).emit(event, data);
    }

    /**
     * Send event to all users in a room
     */
    sendToRoom(roomType, roomId, event, data) {
        const fullRoomId = `${roomType}:${roomId}`;
        this.io.to(fullRoomId).emit(event, data);
    }

    /**
     * Send event to entire tenant
     */
    sendToTenant(tenantId, event, data) {
        this.io.to(`tenant:${tenantId}`).emit(event, data);
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(event, data) {
        this.io.emit(event, data);
    }

    /**
     * Broadcast to all rooms a user belongs to
     */
    broadcastToUserRooms(userId, event, data) {
        const sockets = this.userSockets.get(userId);
        if (!sockets || sockets.size === 0) return;

        const socketId = [...sockets][0];
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            socket.rooms.forEach((room) => {
                if (room !== socketId && !room.startsWith('user:')) {
                    this.io.to(room).emit(event, data);
                }
            });
        }
    }

    // ==================
    // EVENT EMITTERS
    // ==================

    /**
     * Emit new message event
     */
    emitNewMessage(roomType, roomId, message) {
        this.sendToRoom(roomType, roomId, 'new_message', {
            roomType,
            roomId,
            message,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit message updated event
     */
    emitMessageUpdated(roomType, roomId, message) {
        this.sendToRoom(roomType, roomId, 'message_updated', {
            roomType,
            roomId,
            message,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit message deleted event
     */
    emitMessageDeleted(roomType, roomId, messageId) {
        this.sendToRoom(roomType, roomId, 'message_deleted', {
            roomType,
            roomId,
            messageId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit channel created event
     */
    emitChannelCreated(subgridId, channel) {
        this.sendToRoom('subgrid', subgridId, 'channel_created', {
            subgridId,
            channel,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit channel updated event
     */
    emitChannelUpdated(subgridId, channel) {
        this.sendToRoom('subgrid', subgridId, 'channel_updated', {
            subgridId,
            channel,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit channel deleted event
     */
    emitChannelDeleted(subgridId, channelId) {
        this.sendToRoom('subgrid', subgridId, 'channel_deleted', {
            subgridId,
            channelId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit member joined event
     */
    emitMemberJoined(subgridId, member) {
        this.sendToRoom('subgrid', subgridId, 'member_joined', {
            subgridId,
            member,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit member left event
     */
    emitMemberLeft(subgridId, userId) {
        this.sendToRoom('subgrid', subgridId, 'member_left', {
            subgridId,
            userId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit member updated event (role change, etc.)
     */
    emitMemberUpdated(subgridId, member) {
        this.sendToRoom('subgrid', subgridId, 'member_updated', {
            subgridId,
            member,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit post created event
     */
    emitPostCreated(subgridId, post) {
        this.sendToRoom('subgrid', subgridId, 'post_created', {
            subgridId,
            post,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit post updated event
     */
    emitPostUpdated(subgridId, post) {
        this.sendToRoom('subgrid', subgridId, 'post_updated', {
            subgridId,
            post,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit post deleted event
     */
    emitPostDeleted(subgridId, postId) {
        this.sendToRoom('subgrid', subgridId, 'post_deleted', {
            subgridId,
            postId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit comment created event
     */
    emitCommentCreated(subgridId, postId, comment) {
        this.sendToRoom('subgrid', subgridId, 'comment_created', {
            subgridId,
            postId,
            comment,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit incoming call event
     */
    emitIncomingCall(userId, callData) {
        this.sendToUser(userId, 'incoming_call', {
            ...callData,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit call answered event
     */
    emitCallAnswered(callId, userId) {
        this.sendToUser(userId, 'call_answered', {
            callId,
            answeredBy: userId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit call ended event
     */
    emitCallEnded(callId, userIds, reason) {
        userIds.forEach((userId) => {
            this.sendToUser(userId, 'call_ended', {
                callId,
                reason,
                timestamp: new Date().toISOString(),
            });
        });
    }

    /**
     * Emit notification event
     */
    emitNotification(userId, notification) {
        this.sendToUser(userId, 'notification', {
            notification,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit admin dashboard update (KPIs changed)
     */
    emitDashboardUpdate(tenantId, data) {
        this.sendToTenant(tenantId, 'dashboard_update', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit user status change to admin dashboards
     */
    emitUserStatusChange(tenantId, userId, status) {
        this.sendToTenant(tenantId, 'user_status_changed', {
            userId,
            status,
            timestamp: new Date().toISOString(),
        });
    }

    // ==================
    // UTILITY METHODS
    // ==================

    /**
     * Get online users in a room
     */
    getOnlineUsersInRoom(roomType, roomId) {
        const fullRoomId = `${roomType}:${roomId}`;
        return Array.from(this.roomMembers.get(fullRoomId) || []);
    }

    /**
     * Check if user is online
     */
    isUserOnline(userId) {
        return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
    }

    /**
     * Get count of connected users
     */
    getConnectedUsersCount() {
        return this.userSockets.size;
    }

    /**
     * Get all connected user IDs
     */
    getConnectedUserIds() {
        return Array.from(this.userSockets.keys());
    }
}

// Singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;
