/**
 * WebSocket Context
 * Provides shared WebSocket connection across the app
 * Enables real-time sync between dashboards
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, getUserId, getTenantId, resolveUserId, resolveTenantId } from '../lib/api';
import { ConnectionStatus, WebSocketEvents } from '../hooks/useWebSocket';

interface WebSocketContextValue {
    socket: Socket | null;
    status: ConnectionStatus;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    joinRoom: (roomType: string, roomId: string) => void;
    leaveRoom: (roomType: string, roomId: string) => void;
    startTyping: (roomType: string, roomId: string) => void;
    stopTyping: (roomType: string, roomId: string) => void;
    updatePresence: (status: string, statusMessage?: string) => void;
    subscribe: <K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
    children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
    const socketRef = useRef<Socket | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const joinedRoomsRef = useRef<Set<string>>(new Set());
    const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

    const connect = useCallback(async () => {
        if (socketRef.current?.connected) return;

        // Resolve user and tenant IDs
        let userId = getUserId();
        let tenantId = getTenantId();

        if (!userId) {
            userId = await resolveUserId();
        }
        if (!tenantId) {
            tenantId = await resolveTenantId();
        }

        if (!userId) {
            console.warn('[WebSocket] No user ID available, cannot connect');
            return;
        }

        setStatus('connecting');

        const baseUrl = getApiBaseUrl();
        const wsUrl = baseUrl.replace(/\/api$/, '');

        socketRef.current = io(wsUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('[WebSocket] Connected:', socket.id);
            setStatus('connected');

            socket.emit('authenticate', { userId, tenantId });

            // Rejoin rooms
            joinedRoomsRef.current.forEach((room) => {
                const [roomType, roomId] = room.split(':');
                socket.emit('join_room', { roomType, roomId });
            });
        });

        socket.on('authenticated', (data) => {
            console.log('[WebSocket] Authenticated:', data);
        });

        socket.on('disconnect', (reason) => {
            console.log('[WebSocket] Disconnected:', reason);
            setStatus('disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error.message);
            setStatus('error');
        });

        // Forward all events to registered listeners
        const eventTypes: (keyof WebSocketEvents)[] = [
            'new_message', 'message_updated', 'message_deleted',
            'channel_created', 'channel_updated', 'channel_deleted',
            'member_joined', 'member_left', 'member_updated',
            'post_created', 'post_updated', 'post_deleted', 'comment_created',
            'presence_changed', 'user_typing',
            'incoming_call', 'call_answered', 'call_ended',
            'notification', 'dashboard_update', 'user_status_changed',
        ];

        eventTypes.forEach((eventType) => {
            socket.on(eventType, (data: any) => {
                const handlers = listenersRef.current.get(eventType);
                if (handlers) {
                    handlers.forEach((handler) => handler(data));
                }
            });
        });
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setStatus('disconnected');
            joinedRoomsRef.current.clear();
        }
    }, []);

    const joinRoom = useCallback((roomType: string, roomId: string) => {
        if (!socketRef.current?.connected) return;

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

    const subscribe = useCallback(<K extends keyof WebSocketEvents>(
        event: K,
        handler: WebSocketEvents[K]
    ): (() => void) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event)!.add(handler as Function);

        // Return unsubscribe function
        return () => {
            const handlers = listenersRef.current.get(event);
            if (handlers) {
                handlers.delete(handler as Function);
            }
        };
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    const value: WebSocketContextValue = {
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
        subscribe,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketContext = (): WebSocketContextValue => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocketContext must be used within a WebSocketProvider');
    }
    return context;
};

export default WebSocketContext;
