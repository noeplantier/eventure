const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // Required for Expo Router web support
  isStandardEngine: true,
});

// Ensure 'web' is resolved before generic files (needed for expo-notifications etc.)
config.resolver = {
  ...config.resolver,
  platforms: ['ios', 'android', 'web', 'native'],
  resolverMainFields: ['react-native', 'browser', 'main'],
};

// Web shims — route native-only packages to safe stubs when bundling for web
const WEB_SHIMS = {
  'react-native-maps': path.resolve(__dirname, 'shims/react-native-maps.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { filePath: WEB_SHIMS[moduleName], type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (process.env.NETLIFY) {
  config.cacheStores = [];
  config.maxWorkers = 1;
} else {
  config.maxWorkers = 2;
}

module.exports = config;
