/**
 * WebSocket Hook for Web App
 * Real-time bidirectional communication with the backend
 * Enables instant sync between CU Admin and Members dashboards
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, getUserId, getTenantId } from '../lib/api';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketEvents {
    // Messages
    new_message: (data: { roomType: string; roomId: string; message: any; timestamp: string }) => void;
    message_updated: (data: { roomType: string; roomId: string; message: any; timestamp: string }) => void;
    message_deleted: (data: { roomType: string; roomId: string; messageId: string; timestamp: string }) => void;

    // Channels
    channel_created: (data: { subgridId: string; channel: any; timestamp: string }) => void;
    channel_updated: (data: { subgridId: string; channel: any; timestamp: string }) => void;
    channel_deleted: (data: { subgridId: string; channelId: string; timestamp: string }) => void;

    // Members
    member_joined: (data: { subgridId: string; member: any; timestamp: string }) => void;
    member_left: (data: { subgridId: string; userId: string; timestamp: string }) => void;
    member_updated: (data: { subgridId: string; member: any; timestamp: string }) => void;

    // Posts
    post_created: (data: { subgridId: string; post: any; timestamp: string }) => void;
    post_updated: (data: { subgridId: string; post: any; timestamp: string }) => void;
    post_deleted: (data: { subgridId: string; postId: string; timestamp: string }) => void;
    comment_created: (data: { subgridId: string; postId: string; comment: any; timestamp: string }) => void;
    post_liked: (data: { subgridId: string; postId: string; userId: string; likeCount: number; timestamp: string }) => void;
    post_unliked: (data: { subgridId: string; postId: string; userId: string; likeCount: number; timestamp: string }) => void;
    post_reshared: (data: { subgridId: string; postId: string; userId: string; reshareCount: number; timestamp: string }) => void;
    post_unreshared: (data: { subgridId: string; postId: string; userId: string; reshareCount: number; timestamp: string }) => void;

    // Presence
    presence_changed: (data: { userId: string; status: string; statusMessage?: string; timestamp: string }) => void;
    user_typing: (data: { userId: string; roomType: string; roomId: string; isTyping: boolean }) => void;

    // Calls
    incoming_call: (data: any) => void;
    call_answered: (data: { callId: string; answeredBy: string; timestamp: string }) => void;
    call_ended: (data: { callId: string; reason: string; timestamp: string }) => void;

    // Notifications
    notification: (data: { notification: any; timestamp: string }) => void;

    // Admin Dashboard
    dashboard_update: (data: any) => void;
    user_status_changed: (data: { userId: string; status: string; timestamp: string }) => void;
}

interface UseWebSocketOptions {
    autoConnect?: boolean;
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
}

interface UseWebSocketReturn {
    socket: Socket | null;
    status: ConnectionStatus;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    joinRoom: (roomType: string, roomId: string) => void;
    leaveRoom: (roomType: string, roomId: string) => void;
    startTyping: (roomType: string, roomId: string) => void;
    stopTyping: (roomType: string, roomId: string) => void;
    updatePresence: (status: string, statusMessage?: string) => void;
    on: <K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]) => void;
    off: <K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
    const {
        autoConnect = true,
        reconnection = true,
        reconnectionAttempts = 5,
        reconnectionDelay = 1000,
    } = options;

    const socketRef = useRef<Socket | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const joinedRoomsRef = useRef<Set<string>>(new Set());

    const connect = useCallback(() => {
        if (socketRef.current?.connected) return;

        const userId = getUserId();
        const tenantId = getTenantId();

        if (!userId) {
            console.warn('[WebSocket] No user ID available, cannot connect');
            return;
        }

        setStatus('connecting');

        const baseUrl = getApiBaseUrl();
        // Remove /api suffix if present for WebSocket connection
        const wsUrl = baseUrl.replace(/\/api$/, '');

        socketRef.current = io(wsUrl, {
            reconnection,
            reconnectionAttempts,
            reconnectionDelay,
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('[WebSocket] Connected:', socket.id);
            setStatus('connected');

            // Authenticate after connection
            socket.emit('authenticate', { userId, tenantId });

            // Rejoin previously joined rooms
            joinedRoomsRef.current.forEach((room) => {
                const [roomType, roomId] = room.split(':');
                socket.emit('join_room', { roomType, roomId });
            });
        });

        socket.on('authenticated', (data) => {
            console.log('[WebSocket] Authenticated:', data);
        });

        socket.on('auth_error', (error) => {
            console.error('[WebSocket] Auth error:', error);
            setStatus('error');
        });

        socket.on('disconnect', (reason) => {
            console.log('[WebSocket] Disconnected:', reason);
            setStatus('disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error);
            setStatus('error');
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
            setStatus('connected');
        });

        socket.on('reconnect_error', (error) => {
            console.error('[WebSocket] Reconnect error:', error);
        });

        socket.on('reconnect_failed', () => {
            console.error('[WebSocket] Reconnection failed');
            setStatus('error');
        });
    }, [reconnection, reconnectionAttempts, reconnectionDelay]);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setStatus('disconnected');
            joinedRoomsRef.current.clear();
        }
    }, []);

    const joinRoom = useCallback((roomType: string, roomId: string) => {
        if (!socketRef.current?.connected) {
            console.warn('[WebSocket] Not connected, cannot join room');
            return;
        }

        const fullRoomId = `${roomType}:${roomId}`;
        if (!joinedRoomsRef.current.has(fullRoomId)) {
            socketRef.current.emit('join_room', { roomType, roomId });
            joinedRoomsRef.current.add(fullRoomId);
        }
    }, []);

    const leaveRoom = useCallback((roomType: string, roomId: string) => {
        if (!socketRef.current?.connected) return;

        const fullRoomId = `${roomType}:${roomId}`;
        socketRef.current.emit('leave_room', { roomType, roomId });
        joinedRoomsRef.current.delete(fullRoomId);
    }, []);

    const startTyping = useCallback((roomType: string, roomId: string) => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('typing_start', { roomType, roomId });
    }, []);

    const stopTyping = useCallback((roomType: string, roomId: string) => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('typing_stop', { roomType, roomId });
    }, []);

    const updatePresence = useCallback((presenceStatus: string, statusMessage?: string) => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('presence_update', { status: presenceStatus, statusMessage });
    }, []);

    const on = useCallback(<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]) => {
        if (!socketRef.current) return;
        socketRef.current.on(event as string, handler as any);
    }, []);

    const off = useCallback(<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]) => {
        if (!socketRef.current) return;
        socketRef.current.off(event as string, handler as any);
    }, []);

    // Auto-connect on mount if enabled
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        socket: socketRef.current,
        status,
        isConnected: status === 'connected',
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
        startTyping,
        stopTyping,
        updatePresence,
        on,
        off,
    };
};

export default useWebSocket;
