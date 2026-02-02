/**
 * Components barrel file
 * Re-exports components with platform-specific handling where needed
 */

// CallModal - Metro should resolve to .web.tsx for web platform
export { CallModal, default as CallModalDefault } from './CallModal';

// Other components
export { default as UserAvatar } from './UserAvatar';
export { default as VoiceMessagePlayer } from './VoiceMessagePlayer';
export { default as IncomingCallOverlay } from './IncomingCallOverlay';
