/* Edition config. Public values only — NEVER put secrets here.
   apiUrl: '/api/app' = the Cloudflare edge copy (fast); directUrl = the Google Apps Script Web App URL (used for big uploads and as fallback).
   Both empty = DEMO mode, settings saved on device only.
   This app runs on Cloudflare D1 (BACKEND=d1): no Google fallback, so no save can land in the old sheet. */
window.APP_CONFIG = {
  appId: 'converter',
  apiUrl: '/api/app',
  fileUrl: '/api/file',
  directUrl: '',
  botUsername: 'PDF_Tools0_bot',
  defaultLang: 'en',
  editions: {
    global: { defaultLang: 'en' },
    local:  { defaultLang: 'so' }
  },
  version: '1.0.0'
};
