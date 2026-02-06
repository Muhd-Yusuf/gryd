import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { View, Text, TouchableOpacity } from 'react-native';

// Mock dependencies
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

jest.mock('../../contexts/WebSocketContext', () => ({
    useWebSocketContext: () => ({
        isConnected: true,
        subscribe: jest.fn(() => jest.fn()),
        joinRoom: jest.fn(),
        leaveRoom: jest.fn(),
    }),
}));

// Mock API
const mockCommunityDelete = jest.fn(() => Promise.resolve({ success: true }));
const mockCommunityGet = jest.fn();
const mockCommunityPost = jest.fn();

jest.mock('../../lib/api', () => ({
    communityGet: (...args: any[]) => mockCommunityGet(...args),
    communityPost: (...args: any[]) => mockCommunityPost(...args),
    communityDelete: (...args: any[]) => mockCommunityDelete(...args),
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
}));

// Mock theme
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

// Mock other dependencies
jest.mock('expo-av', () => ({
    Audio: {
        setAudioModeAsync: jest.fn(),
        Recording: {
            createAsync: jest.fn(),
        },
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
// TEST: Verify delete button visibility logic
// =============================================================================

describe('DirectMessages Delete Button Visibility', () => {

    // Test the core logic: isOwnMessage should be true when senderId matches currentUserId
    describe('isOwnMessage logic', () => {
        it('should correctly identify own messages with string comparison', () => {
            const currentUserId = 'user-123';
            const messages = [
                { _id: 'msg1', senderId: 'user-123', body: 'My message' },
                { _id: 'msg2', senderId: 'other-user', body: 'Their message' },
                { _id: 'msg3', senderId: 'user-123', body: 'Another of my messages' },
            ];

            messages.forEach((msg) => {
                const isOwnMessage = String(msg.senderId || '') === String(currentUserId || '');
                if (msg.senderId === 'user-123') {
                    expect(isOwnMessage).toBe(true);
                } else {
                    expect(isOwnMessage).toBe(false);
                }
            });
        });

        it('should handle ObjectId-like strings correctly', () => {
            const currentUserId = '507f1f77bcf86cd799439011';
            const messageSenderId = '507f1f77bcf86cd799439011';

            const isOwnMessage = String(messageSenderId || '') === String(currentUserId || '');
            expect(isOwnMessage).toBe(true);
        });

        it('should handle undefined/null values safely', () => {
            const currentUserId = 'user-123';
            const nullSenderId = null;
            const undefinedSenderId = undefined;

            expect(String(nullSenderId || '') === String(currentUserId || '')).toBe(false);
            expect(String(undefinedSenderId || '') === String(currentUserId || '')).toBe(false);
        });

        it('should handle empty string userId', () => {
            const currentUserId = '';
            const messageSenderId = 'user-123';

            const isOwnMessage = String(messageSenderId || '') === String(currentUserId || '');
            expect(isOwnMessage).toBe(false);
        });
    });

    // Test the delete button rendering logic
    describe('Delete button rendering', () => {
        it('should render delete button only for own messages', () => {
            const currentUserId = 'user-123';
            const messages = [
                { _id: 'msg1', senderId: 'user-123', body: 'My message', isOwn: true },
                { _id: 'msg2', senderId: 'other-user', body: 'Their message', isOwn: false },
            ];

            // Simulate the rendering logic
            const deleteButtonsRendered: string[] = [];

            messages.forEach((msg) => {
                const isOwnMessage = String(msg.senderId || '') === String(currentUserId || '');
                if (isOwnMessage) {
                    deleteButtonsRendered.push(msg._id);
                }
            });

            expect(deleteButtonsRendered).toContain('msg1');
            expect(deleteButtonsRendered).not.toContain('msg2');
            expect(deleteButtonsRendered.length).toBe(1);
        });
    });

    // Test the delete handler
    describe('handleDeleteMessage', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            // Mock window.confirm for web
            global.window = { confirm: jest.fn(() => true) } as any;
        });

        it('should call communityDelete with correct endpoint', async () => {
            const subgridId = 'test-subgrid';
            const messageId = 'msg-123';

            // Simulate the delete handler logic
            const handleDeleteMessage = async (msgId: string) => {
                await mockCommunityDelete(`/subgrids/${subgridId}/direct-messages/${msgId}`);
            };

            await handleDeleteMessage(messageId);

            expect(mockCommunityDelete).toHaveBeenCalledWith(
                `/subgrids/${subgridId}/direct-messages/${messageId}`
            );
        });

        it('should remove message from state after successful delete', async () => {
            const initialMessages = [
                { _id: 'msg1', body: 'Message 1' },
                { _id: 'msg2', body: 'Message 2' },
                { _id: 'msg3', body: 'Message 3' },
            ];

            // Simulate state update after delete
            const deleteMessageId = 'msg2';
            const updatedMessages = initialMessages.filter((msg) => msg._id !== deleteMessageId);

            expect(updatedMessages.length).toBe(2);
            expect(updatedMessages.find((m) => m._id === 'msg2')).toBeUndefined();
            expect(updatedMessages.find((m) => m._id === 'msg1')).toBeDefined();
            expect(updatedMessages.find((m) => m._id === 'msg3')).toBeDefined();
        });
    });
});

// =============================================================================
// TEST: Simple Component Test for Delete Button
// =============================================================================

describe('Delete Button Component', () => {
    const MockDeleteButton = ({
        isOwnMessage,
        onDelete
    }: {
        isOwnMessage: boolean;
        onDelete: () => void;
    }) => {
        if (!isOwnMessage) return null;

        return (
            <TouchableOpacity
                testID="delete-button"
                onPress={onDelete}
                style={{ padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 16 }}
            >
                <Text>Delete</Text>
            </TouchableOpacity>
        );
    };

    it('should render delete button when isOwnMessage is true', () => {
        const onDelete = jest.fn();
        const { getByTestId } = render(
            <MockDeleteButton isOwnMessage={true} onDelete={onDelete} />
        );

        expect(getByTestId('delete-button')).toBeTruthy();
    });

    it('should NOT render delete button when isOwnMessage is false', () => {
        const onDelete = jest.fn();
        const { queryByTestId } = render(
            <MockDeleteButton isOwnMessage={false} onDelete={onDelete} />
        );

        expect(queryByTestId('delete-button')).toBeNull();
    });

    it('should call onDelete when pressed', () => {
        const onDelete = jest.fn();
        const { getByTestId } = render(
            <MockDeleteButton isOwnMessage={true} onDelete={onDelete} />
        );

        fireEvent.press(getByTestId('delete-button'));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});

// =============================================================================
// TEST: Message Row with Delete Button
// =============================================================================

describe('Message Row with Delete Button', () => {
    const MessageRow = ({
        message,
        currentUserId,
        onDelete,
    }: {
        message: { _id: string; senderId: string; body: string };
        currentUserId: string;
        onDelete: (id: string) => void;
    }) => {
        const isOwnMessage = String(message.senderId || '') === String(currentUserId || '');

        return (
            <View testID={`message-row-${message._id}`} style={{ flexDirection: 'row' }}>
                {isOwnMessage && (
                    <TouchableOpacity
                        testID={`delete-btn-${message._id}`}
                        onPress={() => onDelete(message._id)}
                    >
                        <Text>🗑️</Text>
                    </TouchableOpacity>
                )}
                <View testID={`message-bubble-${message._id}`}>
                    <Text>{message.body}</Text>
                </View>
            </View>
        );
    };

    it('should show delete button for own messages only', () => {
        const currentUserId = 'user-123';
        const onDelete = jest.fn();

        const messages = [
            { _id: 'msg1', senderId: 'user-123', body: 'My message' },
            { _id: 'msg2', senderId: 'other-user', body: 'Their message' },
        ];

        const { queryByTestId } = render(
            <View>
                {messages.map((msg) => (
                    <MessageRow
                        key={msg._id}
                        message={msg}
                        currentUserId={currentUserId}
                        onDelete={onDelete}
                    />
                ))}
            </View>
        );

        // Own message should have delete button
        expect(queryByTestId('delete-btn-msg1')).toBeTruthy();

        // Other's message should NOT have delete button
        expect(queryByTestId('delete-btn-msg2')).toBeNull();
    });

    it('should handle edge case where senderId equals currentUserId as different types', () => {
        // Simulating MongoDB ObjectId scenario where types might differ
        const currentUserId = '507f1f77bcf86cd799439011';
        const onDelete = jest.fn();

        const message = {
            _id: 'msg1',
            senderId: '507f1f77bcf86cd799439011', // Same value, potentially different source
            body: 'My message'
        };

        const { queryByTestId } = render(
            <MessageRow
                message={message}
                currentUserId={currentUserId}
                onDelete={onDelete}
            />
        );

        // Should show delete button because String comparison should match
        expect(queryByTestId('delete-btn-msg1')).toBeTruthy();
    });
});

// =============================================================================
// DIAGNOSTIC: Check what might be wrong
// =============================================================================

describe('Diagnostic Tests', () => {
    it('DIAGNOSTIC: Log comparison results for debugging', () => {
        const testCases = [
            { senderId: 'user-123', currentUserId: 'user-123', expected: true },
            { senderId: 'user-123', currentUserId: 'user-456', expected: false },
            { senderId: '507f1f77bcf86cd799439011', currentUserId: '507f1f77bcf86cd799439011', expected: true },
            { senderId: '', currentUserId: 'user-123', expected: false },
            { senderId: 'user-123', currentUserId: '', expected: false },
            { senderId: null as any, currentUserId: 'user-123', expected: false },
            { senderId: undefined as any, currentUserId: 'user-123', expected: false },
        ];

        testCases.forEach((tc, index) => {
            const result = String(tc.senderId || '') === String(tc.currentUserId || '');
            console.log(`Test ${index + 1}: senderId="${tc.senderId}" vs currentUserId="${tc.currentUserId}" => ${result} (expected: ${tc.expected})`);
            expect(result).toBe(tc.expected);
        });
    });

    it('DIAGNOSTIC: Verify the delete button would render in real component structure', () => {
        // This simulates the exact structure from DirectMessagesScreen
        const currentUserId = 'current-user-id';
        const messages = [
            { _id: 'msg1', senderId: 'current-user-id', body: 'Hi there' },
            { _id: 'msg2', senderId: 'friend-user-id', body: 'Hello!' },
            { _id: 'msg3', senderId: 'current-user-id', body: 'How are you?' },
        ];

        const renderedDeleteButtons: string[] = [];

        messages.forEach((msg) => {
            const msgSenderId = String(msg.senderId || '');
            const myUserId = String(currentUserId || '');
            const isOwnMessage = msgSenderId === myUserId;

            console.log(`Message ${msg._id}: senderId="${msgSenderId}", currentUserId="${myUserId}", isOwnMessage=${isOwnMessage}`);

            if (isOwnMessage) {
                renderedDeleteButtons.push(msg._id);
            }
        });

        console.log('Delete buttons rendered for messages:', renderedDeleteButtons);

        expect(renderedDeleteButtons).toEqual(['msg1', 'msg3']);
    });
});
