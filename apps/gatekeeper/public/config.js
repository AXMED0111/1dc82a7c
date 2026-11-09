/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads). */
window.APP_CONFIG = {
  appId: 'gatekeeper',
  apiUrl: '/api/app',
  directUrl: 'https://script.google.com/macros/s/AKfycbzaeeN73kALm7qR6HB9wNVrtKVhOBFsAIhdAgEfiNHGthVJw4GlHsD9TM1fPOjqGTXM7A/exec',
  botUsername: 'ChannelPass0_bot',
  appShortName: '',
  defaultLang: 'en',
  version: '1.0.0'
};
