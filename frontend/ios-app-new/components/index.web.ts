/**
 * Components barrel file - Web Platform
 * Re-exports components for web platform
 */

// CallModal - explicitly import from web implementation
export { CallModal, default as CallModalDefault } from './CallModal.web';

// Other components (no platform-specific versions)
export { default as UserAvatar } from './UserAvatar';
export { default as VoiceMessagePlayer } from './VoiceMessagePlayer';
export { default as IncomingCallOverlay } from './IncomingCallOverlay';
