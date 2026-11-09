/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads). */
window.APP_CONFIG = {
  appId: 'rsvp',
  apiUrl: '/api/app',
  directUrl: 'https://script.google.com/macros/s/AKfycbybw_eAaS8w7aYmyKUBujSlT0kquUbuXN1tUtVBMP0-YWj_PCrVhnG0r1OnOUT4v90b/exec',
  botUsername: 'Invitations0_bot',
  appShortName: '',
  defaultLang: 'en',
  version: '1.0.0'
};
