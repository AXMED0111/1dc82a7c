/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads).
   Debt Book runs on Cloudflare D1 (BACKEND=d1): no Google fallback, so no save can land in the old sheet. */
window.APP_CONFIG = {
  appId: 'debt',
  apiUrl: '/api/app',
  directUrl: '',
  botUsername: 'DebtBook0_bot',
  appShortName: '',
  defaultLang: 'so',
  version: '1.0.0'
};
