// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure platform-specific extensions are resolved correctly
// Metro bundler uses this list to try file extensions in order
// By default, Expo should already handle .web.ts/.web.tsx for web platform
// but we're explicitly ensuring they're at the front for web builds

// Get existing source extensions
const sourceExts = config.resolver.sourceExts || [];

// Ensure web extensions are in the list (they should be by default, but let's be explicit)
const webExts = ['web.tsx', 'web.ts', 'web.jsx', 'web.js'];
const filteredExts = sourceExts.filter(ext => !webExts.includes(ext));
config.resolver.sourceExts = [...webExts, ...filteredExts];

// Also add platform-specific resolver
// This helps Metro understand platform extensions
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
