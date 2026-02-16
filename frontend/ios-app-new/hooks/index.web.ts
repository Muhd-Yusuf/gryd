/**
 * Hooks barrel file - Web Platform
 * This file explicitly re-exports hooks for web platform
 */

// Re-export useAgoraCall from web implementation
export { useAgoraCall } from './useAgoraCall.web';
export type { CallState, CallType, CallSession, IncomingCall, CallParticipant } from './useAgoraCall.web';

// Scroll management for chat screens
export { useScrollToBottom } from './useScrollToBottom';
export type { UseScrollToBottomReturn } from './useScrollToBottom';
