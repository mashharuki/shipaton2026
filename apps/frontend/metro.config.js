const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// expo-sqlite (4.3) needs wasm asset support + COEP/COOP headers to run on
// the web target (SharedArrayBuffer), per Expo's SQLite docs' Metro diff.
config.resolver.assetExts.push("wasm");
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    middleware(req, res, next);
  };
};

module.exports = config;
