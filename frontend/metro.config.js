const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // Indispensable pour Expo Router et le support Web
  isStandardEngine: true,
});

// Ensure 'web' is included in the platform list so that .web.ts / .web.js
// stubs are resolved before their generic counterparts.
// This is necessary for modules like expo-notifications that crash on web.
config.resolver = {
  ...config.resolver,
  platforms: ['ios', 'android', 'web', 'native'],
};

// Sur Netlify, on évite le cache disque personnalisé qui peut causer des erreurs de module
if (process.env.NETLIFY) {
  config.cacheStores = [];
  config.maxWorkers = 1; // Netlify a des ressources limitées, 1 worker évite les crashs mémoire
} else {
  config.maxWorkers = 2;
}

module.exports = config;
