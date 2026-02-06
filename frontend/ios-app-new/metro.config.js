// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Use Expo's default extension handling - it correctly resolves .web.ts files
// only when building for web platform. We should NOT manually reorder extensions
// as that breaks native builds by loading web files incorrectly.

module.exports = config;
