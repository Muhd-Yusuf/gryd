/**
 * WebSocket Context
 * Provides shared WebSocket connection across the app
 * Enables real-time sync between dashboards
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
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

        // Clean up any existing disconnected socket before creating a new one
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
        }

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
            return;
        }

        setStatus('connecting');

        // Dynamically resolve WebSocket URL, especially important for mobile
        let wsUrl: string;
        const baseUrl = getApiBaseUrl();

        if (Platform.OS !== 'web') {
            // If API points to a remote server, use the same host for WebSocket
            if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
                wsUrl = baseUrl.replace(/\/api$/, '');
            } else {
                // For local development, use Expo's hostUri to get dev machine IP
                const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
                if (hostUri) {
                    const host = String(hostUri).split(':')[0];
                    if (host && host !== 'localhost') {
                        wsUrl = `http://${host}:4000`;
                    } else {
                        wsUrl = baseUrl.replace(/\/api$/, '');
                    }
                } else {
                    wsUrl = baseUrl.replace(/\/api$/, '');
                }
            }
        } else {
            wsUrl = baseUrl.replace(/\/api$/, '');
        }

        socketRef.current = io(wsUrl, {
            reconnection: true,
            reconnectionAttempts: 15,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000, // Exponential backoff caps at 30 seconds
            randomizationFactor: 0.5, // Add jitter to prevent thundering herd
            transports: ['polling', 'websocket'],
            autoConnect: true,
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            socket.emit('authenticate', { userId, tenantId });
        });

        socket.on('authenticated', () => {
            setStatus('connected');

            // Rejoin rooms after authentication is complete
            joinedRoomsRef.current.forEach((room) => {
                const [roomType, roomId] = room.split(':');
                socket.emit('join_room', { roomType, roomId });
            });
        });

        socket.on('auth_error', () => {
            setStatus('error');
        });

        socket.on('disconnect', () => {
            setStatus('disconnected');
        });

        socket.on('connect_error', () => {
            setStatus('error');
        });

        socket.on('reconnect', () => {
            // Re-authenticate after reconnection - the 'connect' handler will also fire
            // but we emit authenticate here as well to ensure it happens
            socket.emit('authenticate', { userId, tenantId });
        });

        socket.on('reconnect_attempt', () => {
            // Reconnection attempt in progress
        });

        // Listen for room_joined confirmation from server
        socket.on('room_joined', () => {
            // Room joined
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
            // Untyped but needed for native call handling:
            'call_declined' as any, 'call_missed' as any,
        ];

        eventTypes.forEach((eventType) => {
            socket.on(eventType, (data: any) => {
                console.log(`[WebSocket] Event received: ${eventType}`, JSON.stringify(data, null, 2));
                const handlers = listenersRef.current.get(eventType);
                if (handlers) {
                    console.log(`[WebSocket] Dispatching to ${handlers.size} handlers`);
                    handlers.forEach((handler) => handler(data));
                } else {
                    console.log(`[WebSocket] No handlers registered for ${eventType}`);
                }
            });
        });

        // Also listen for 'direct_message' event (alternative event name some servers use)
        socket.on('direct_message', (data: any) => {
            console.log('[WebSocket] direct_message event received:', JSON.stringify(data, null, 2));
            // Forward to new_message handlers
            const handlers = listenersRef.current.get('new_message');
            if (handlers) {
                handlers.forEach((handler) => handler({ ...data, roomType: 'dm' }));
            }
        });

        // Listen for 'dm' event (another alternative)
        socket.on('dm', (data: any) => {
            console.log('[WebSocket] dm event received:', JSON.stringify(data, null, 2));
            // Forward to new_message handlers
            const handlers = listenersRef.current.get('new_message');
            if (handlers) {
                handlers.forEach((handler) => handler({ ...data, roomType: 'dm' }));
            }
        });

    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setStatus('disconnected');
            joinedRoomsRef.current.clear();
        }
    }, []);

    const joinRoom = useCallback((roomType: string, roomId: string) => {
        const fullRoomId = `${roomType}:${roomId}`;
        console.log('[WebSocket] joinRoom called:', roomType, roomId, 'connected:', !!socketRef.current?.connected);

        // Always track the room we want to join
        if (!joinedRoomsRef.current.has(fullRoomId)) {
            joinedRoomsRef.current.add(fullRoomId);
        }

        // If socket is connected, emit join_room immediately
        if (socketRef.current?.connected) {
            console.log('[WebSocket] Emitting join_room:', { roomType, roomId });
            socketRef.current.emit('join_room', { roomType, roomId });
        } else {
            console.log('[WebSocket] Socket not connected, room will be joined after connection');
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

    // Reconnect when app comes back to foreground
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active' && !socketRef.current?.connected) {
                connect();
            }
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, [connect]);

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
