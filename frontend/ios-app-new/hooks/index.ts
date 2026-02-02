/**
 * Hooks barrel file
 * This file re-exports hooks with platform-specific handling
 */

// Re-export useAgoraCall - Metro should automatically resolve to .web.ts for web platform
// If platform resolution isn't working, consumers can import directly from the specific file:
// - Web: import { useAgoraCall } from './useAgoraCall.web'
// - Native: import { useAgoraCall } from './useAgoraCall'
export { useAgoraCall } from './useAgoraCall';
export type { CallState, CallType, CallSession, IncomingCall, CallParticipant } from './useAgoraCall';
