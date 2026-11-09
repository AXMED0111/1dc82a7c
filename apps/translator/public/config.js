/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads). */
window.APP_CONFIG = {
  appId: 'translator',
  apiUrl: '/api/app',
  directUrl: 'https://script.google.com/macros/s/AKfycbxz_dwjwAbuESMEK3wWWfpYFVjX1X8gG3BAn6_LUhgLfX8qtRhh7Y-QjKfChu51g1Iy/exec',
  botUsername: 'DocTranslator0_bot',
  appShortName: '',
  defaultLang: 'en',
  version: '1.0.0'
};
