/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads).
   This app runs on Cloudflare D1 (BACKEND=d1): no Google fallback, so no save can land in the old sheet. */
window.APP_CONFIG = {
  appId: 'rsvp',
  apiUrl: '/api/app',
  fileUrl: '/api/file',
  directUrl: '',
  botUsername: 'Invitations0_bot',
  appShortName: '',
  defaultLang: 'en',
  version: '1.0.0'
};
