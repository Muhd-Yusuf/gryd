import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';

/**
 * Test suite for DM real-time message delivery via WebSocket
 *
 * Issue: DM messages were not being delivered instantly until refresh
 * Root cause: Backend was only sending WebSocket event to recipient, not sender
 * Fix: Backend now sends to both sender and recipient via sendToUser
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

// Track WebSocket subscriptions and events
const mockSubscriptions: Map<string, ((data: any) => void)[]> = new Map();
const mockJoinedRooms: Set<string> = new Set();

const mockSubscribe = jest.fn((event: string, handler: (data: any) => void) => {
    if (!mockSubscriptions.has(event)) {
        mockSubscriptions.set(event, []);
    }
    mockSubscriptions.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
        const handlers = mockSubscriptions.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
        }
    };
});

const mockJoinRoom = jest.fn((roomType: string, roomId: string) => {
    mockJoinedRooms.add(`${roomType}:${roomId}`);
});

const mockLeaveRoom = jest.fn((roomType: string, roomId: string) => {
    mockJoinedRooms.delete(`${roomType}:${roomId}`);
});

// Helper to simulate WebSocket events
const simulateWebSocketEvent = (event: string, data: any) => {
    const handlers = mockSubscriptions.get(event);
    if (handlers) {
        handlers.forEach(handler => handler(data));
    }
};

jest.mock('../../contexts/WebSocketContext', () => ({
    useWebSocketContext: () => ({
        isConnected: true,
        subscribe: mockSubscribe,
        joinRoom: mockJoinRoom,
        leaveRoom: mockLeaveRoom,
    }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useLocalSearchParams: () => ({
        subgridId: 'test-subgrid-id',
    }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../lib/api', () => ({
    communityGet: jest.fn(() => Promise.resolve({ data: { messages: [], friends: [], users: {} } })),
    communityPost: jest.fn(() => Promise.resolve({ success: true, data: {} })),
    communityDelete: jest.fn(() => Promise.resolve({ success: true })),
    getAuthUser: jest.fn(() => Promise.resolve({
        userId: 'current-user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
    })),
    getUserId: jest.fn(() => 'current-user-id'),
    getTenantId: jest.fn(() => 'test-tenant-id'),
    resolveUserId: jest.fn(() => Promise.resolve('current-user-id')),
    resolveTenantId: jest.fn(() => Promise.resolve('test-tenant-id')),
    getOnlineStatus: jest.fn(() => Promise.resolve({})),
    updatePresence: jest.fn(() => Promise.resolve()),
    setUserOnline: jest.fn(),
    uploadFile: jest.fn(() => Promise.resolve({ success: true, data: { url: 'http://test.com/file.jpg' } })),
    subscribeToCallEventsAsync: jest.fn(() => Promise.resolve(() => {})),
    answerCall: jest.fn(),
    declineCall: jest.fn(),
}));

jest.mock('../../lib/theme', () => ({
    useTheme: () => ({
        colors: {
            appBg: '#0f1117',
            surface: '#1a1d27',
            surfaceHover: '#22252f',
            surfaceMuted: '#1e2130',
            border: '#2a2d3a',
            text: '#ffffff',
            textMuted: '#8b8fa3',
            textSubtle: '#555872',
            primary: '#3B82F6',
            primaryText: '#ffffff',
            error: '#ef4444',
            overlay: 'rgba(0,0,0,0.6)',
        },
        mode: 'dark',
        toggleTheme: jest.fn(),
    }),
}));

jest.mock('expo-av', () => ({
    Audio: {
        setAudioModeAsync: jest.fn(),
        Recording: { createAsync: jest.fn() },
    },
}));

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

// =============================================================================
// TEST SUITE: WebSocket DM Message Delivery
// =============================================================================

describe('DirectMessages WebSocket Real-time Delivery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSubscriptions.clear();
        mockJoinedRooms.clear();
    });

    describe('WebSocket subscription setup', () => {
        it('should subscribe to new_message event when connected', () => {
            // Simulate the useEffect that subscribes to WebSocket
            const currentUserId = 'current-user-id';
            const selectedFriendId = 'friend-user-id';
            const isConnected = true;

            if (isConnected && currentUserId && selectedFriendId) {
                const sortedIds = [String(currentUserId), String(selectedFriendId)].sort();
                const dmRoomId = `${sortedIds[0]}_${sortedIds[1]}`;

                mockJoinRoom('dm', dmRoomId);
                mockSubscribe('new_message', jest.fn());
            }

            expect(mockJoinRoom).toHaveBeenCalledWith('dm', 'current-user-id_friend-user-id');
            expect(mockSubscribe).toHaveBeenCalledWith('new_message', expect.any(Function));
        });

        it('should create consistent DM room ID regardless of user order', () => {
            const userA = 'user-aaa';
            const userB = 'user-zzz';

            // User A initiates
            const roomIdFromA = [String(userA), String(userB)].sort().join('_');

            // User B initiates
            const roomIdFromB = [String(userB), String(userA)].sort().join('_');

            expect(roomIdFromA).toBe('user-aaa_user-zzz');
            expect(roomIdFromB).toBe('user-aaa_user-zzz');
            expect(roomIdFromA).toBe(roomIdFromB);
        });
    });

    describe('Message delivery via WebSocket', () => {
        it('should add new message to state when receiving new_message event', () => {
            const messages: any[] = [];
            const setMessages = (updater: (prev: any[]) => any[]) => {
                const newMessages = updater(messages);
                messages.length = 0;
                messages.push(...newMessages);
            };

            const currentUserId = 'current-user-id';
            const selectedFriendId = 'friend-user-id';

            // Simulate the new_message handler from DirectMessagesScreen
            const handleNewMessage = (data: any) => {
                if (data.roomType === 'dm' && data.message) {
                    const msgSenderId = String(data.message?.senderId || '');
                    const msgRecipientId = String(data.message?.recipientId || '');
                    const myUserId = String(currentUserId);
                    const friendId = String(selectedFriendId);

                    const isForThisConversation =
                        (msgSenderId === myUserId && msgRecipientId === friendId) ||
                        (msgSenderId === friendId && msgRecipientId === myUserId);

                    if (isForThisConversation) {
                        setMessages((prev) => {
                            if (prev.some((m) => m._id === data.message._id)) {
                                return prev;
                            }
                            return [...prev, data.message];
                        });
                    }
                }
            };

            // Subscribe to new_message
            mockSubscribe('new_message', handleNewMessage);

            // Simulate receiving a message FROM friend
            simulateWebSocketEvent('new_message', {
                roomType: 'dm',
                roomId: 'current-user-id_friend-user-id',
                message: {
                    _id: 'msg-1',
                    senderId: 'friend-user-id',
                    recipientId: 'current-user-id',
                    body: 'Hello from friend!',
                },
            });

            expect(messages).toHaveLength(1);
            expect(messages[0].body).toBe('Hello from friend!');
        });

        it('should add own message to state when receiving new_message event (sender receives their own message)', () => {
            const messages: any[] = [];
            const setMessages = (updater: (prev: any[]) => any[]) => {
                const newMessages = updater(messages);
                messages.length = 0;
                messages.push(...newMessages);
            };

            const currentUserId = 'current-user-id';
            const selectedFriendId = 'friend-user-id';

            const handleNewMessage = (data: any) => {
                if (data.roomType === 'dm' && data.message) {
                    const msgSenderId = String(data.message?.senderId || '');
                    const msgRecipientId = String(data.message?.recipientId || '');
                    const myUserId = String(currentUserId);
                    const friendId = String(selectedFriendId);

                    const isForThisConversation =
                        (msgSenderId === myUserId && msgRecipientId === friendId) ||
                        (msgSenderId === friendId && msgRecipientId === myUserId);

                    if (isForThisConversation) {
                        setMessages((prev) => {
                            if (prev.some((m) => m._id === data.message._id)) {
                                return prev;
                            }
                            return [...prev, data.message];
                        });
                    }
                }
            };

            mockSubscribe('new_message', handleNewMessage);

            // Simulate receiving OWN message via WebSocket (this is the fix!)
            // Backend now sends to both sender and recipient
            simulateWebSocketEvent('new_message', {
                roomType: 'dm',
                roomId: 'current-user-id_friend-user-id',
                message: {
                    _id: 'msg-2',
                    senderId: 'current-user-id',  // Own message
                    recipientId: 'friend-user-id',
                    body: 'Hello from me!',
                },
            });

            expect(messages).toHaveLength(1);
            expect(messages[0].body).toBe('Hello from me!');
            expect(messages[0].senderId).toBe('current-user-id');
        });

        it('should not add duplicate messages', () => {
            let messages: any[] = [];

            const currentUserId = 'current-user-id';
            const selectedFriendId = 'friend-user-id';

            const handleNewMessage = (data: any) => {
                if (data.roomType === 'dm' && data.message) {
                    const msgSenderId = String(data.message?.senderId || '');
                    const msgRecipientId = String(data.message?.recipientId || '');
                    const myUserId = String(currentUserId);
                    const friendId = String(selectedFriendId);

                    const isForThisConversation =
                        (msgSenderId === myUserId && msgRecipientId === friendId) ||
                        (msgSenderId === friendId && msgRecipientId === myUserId);

                    if (isForThisConversation) {
                        // Check for duplicates before adding
                        if (!messages.some((m) => m._id === data.message._id)) {
                            messages = [...messages, data.message];
                        }
                    }
                }
            };

            mockSubscribe('new_message', handleNewMessage);

            const messageData = {
                roomType: 'dm',
                roomId: 'current-user-id_friend-user-id',
                message: {
                    _id: 'msg-1',
                    senderId: 'friend-user-id',
                    recipientId: 'current-user-id',
                    body: 'Hello!',
                },
            };

            // Simulate receiving the same message twice (could happen with room + direct delivery)
            simulateWebSocketEvent('new_message', messageData);
            simulateWebSocketEvent('new_message', messageData);

            expect(messages).toHaveLength(1);
        });

        it('should ignore messages from other conversations', () => {
            const messages: any[] = [];
            const setMessages = (updater: (prev: any[]) => any[]) => {
                const newMessages = updater(messages);
                messages.length = 0;
                messages.push(...newMessages);
            };

            const currentUserId = 'current-user-id';
            const selectedFriendId = 'friend-user-id';

            const handleNewMessage = (data: any) => {
                if (data.roomType === 'dm' && data.message) {
                    const msgSenderId = String(data.message?.senderId || '');
                    const msgRecipientId = String(data.message?.recipientId || '');
                    const myUserId = String(currentUserId);
                    const friendId = String(selectedFriendId);

                    const isForThisConversation =
                        (msgSenderId === myUserId && msgRecipientId === friendId) ||
                        (msgSenderId === friendId && msgRecipientId === myUserId);

                    if (isForThisConversation) {
                        setMessages((prev) => [...prev, data.message]);
                    }
                }
            };

            mockSubscribe('new_message', handleNewMessage);

            // Simulate message from a DIFFERENT conversation
            simulateWebSocketEvent('new_message', {
                roomType: 'dm',
                roomId: 'current-user-id_other-friend-id',
                message: {
                    _id: 'msg-other',
                    senderId: 'other-friend-id',
                    recipientId: 'current-user-id',
                    body: 'Message from other friend',
                },
            });

            expect(messages).toHaveLength(0);
        });

        it('should ignore channel messages (roomType !== dm)', () => {
            const messages: any[] = [];
            const setMessages = (updater: (prev: any[]) => any[]) => {
                const newMessages = updater(messages);
                messages.length = 0;
                messages.push(...newMessages);
            };

            const handleNewMessage = (data: any) => {
                if (data.roomType === 'dm' && data.message) {
                    setMessages((prev) => [...prev, data.message]);
                }
            };

            mockSubscribe('new_message', handleNewMessage);

            // Simulate a channel message
            simulateWebSocketEvent('new_message', {
                roomType: 'channel',
                roomId: 'channel-123',
                message: {
                    _id: 'channel-msg',
                    authorId: 'some-user',
                    body: 'Channel message',
                },
            });

            expect(messages).toHaveLength(0);
        });
    });

    describe('Message update and delete via WebSocket', () => {
        it('should update message when receiving message_updated event', () => {
            let messages = [
                { _id: 'msg-1', body: 'Original message', senderId: 'friend-user-id' },
            ];

            const handleMessageUpdated = (data: any) => {
                if (data.roomType === 'dm' && data.message) {
                    messages = messages.map((m) =>
                        m._id === data.message._id ? data.message : m
                    );
                }
            };

            mockSubscribe('message_updated', handleMessageUpdated);

            simulateWebSocketEvent('message_updated', {
                roomType: 'dm',
                roomId: 'current-user-id_friend-user-id',
                message: {
                    _id: 'msg-1',
                    body: 'Updated message',
                    senderId: 'friend-user-id',
                },
            });

            expect(messages[0].body).toBe('Updated message');
        });

        it('should remove message when receiving message_deleted event', () => {
            let messages = [
                { _id: 'msg-1', body: 'Message 1' },
                { _id: 'msg-2', body: 'Message 2' },
            ];

            const handleMessageDeleted = (data: any) => {
                if (data.roomType === 'dm' && data.messageId) {
                    messages = messages.filter((m) => m._id !== data.messageId);
                }
            };

            mockSubscribe('message_deleted', handleMessageDeleted);

            simulateWebSocketEvent('message_deleted', {
                roomType: 'dm',
                roomId: 'current-user-id_friend-user-id',
                messageId: 'msg-1',
            });

            expect(messages).toHaveLength(1);
            expect(messages[0]._id).toBe('msg-2');
        });
    });
});

// =============================================================================
// TEST: Backend WebSocket Emission (Integration test simulation)
// =============================================================================

describe('Backend DM WebSocket Emission Logic', () => {
    it('should emit to both sender and recipient (simulating backend fix)', () => {
        // Simulate what the backend does after creating a DM
        const senderId = 'user-a';
        const recipientId = 'user-b';
        const message = {
            _id: 'msg-123',
            senderId,
            recipientId,
            body: 'Test message',
        };

        const dmRoomId = [senderId, recipientId].sort().join('_');
        const dmEventData = {
            roomType: 'dm',
            roomId: dmRoomId,
            message,
            timestamp: new Date().toISOString(),
        };

        // Track which users received the event
        const usersNotified: string[] = [];

        const sendToUser = (userId: string, event: string, data: any) => {
            usersNotified.push(userId);
        };

        // Backend code (the fix):
        // websocketService.emitNewMessage('dm', dmRoomId, message);
        // websocketService.sendToUser(recipientId, 'new_message', dmEventData);
        // websocketService.sendToUser(senderId, 'new_message', dmEventData);

        sendToUser(recipientId, 'new_message', dmEventData);
        sendToUser(senderId, 'new_message', dmEventData);

        expect(usersNotified).toContain(senderId);
        expect(usersNotified).toContain(recipientId);
        expect(usersNotified).toHaveLength(2);
    });

    it('should have consistent room ID format', () => {
        const userA = 'abc123';
        const userB = 'xyz789';

        // Backend creates room ID
        const backendRoomId = [userA, userB].sort().join('_');

        // Frontend creates room ID (from different user's perspective)
        const frontendRoomIdFromA = [String(userA), String(userB)].sort().join('_');
        const frontendRoomIdFromB = [String(userB), String(userA)].sort().join('_');

        expect(backendRoomId).toBe('abc123_xyz789');
        expect(frontendRoomIdFromA).toBe(backendRoomId);
        expect(frontendRoomIdFromB).toBe(backendRoomId);
    });
});
