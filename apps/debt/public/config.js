/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads). */
window.APP_CONFIG = {
  appId: 'debt',
  apiUrl: '/api/app',
  directUrl: 'https://script.google.com/macros/s/AKfycbz9bXN1s7ufRbrfowMXdt3HBhrbLw60OwjTtRMOO451G_I5CrEkKHAmUDRW28ESPl9G/exec',
  botUsername: 'DebtBook0_bot',
  appShortName: '',
  defaultLang: 'so',
  version: '1.0.0'
};
