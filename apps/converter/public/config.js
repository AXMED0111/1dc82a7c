/* Edition config. Public values only — NEVER put secrets here.
   apiUrl: '/api/app' = the Cloudflare edge copy (fast); directUrl = the Google Apps Script Web App URL (used for big uploads and as fallback).
   Both empty = DEMO mode, settings saved on device only. */
window.APP_CONFIG = {
  appId: 'converter',
  apiUrl: '/api/app',
  directUrl: 'https://script.google.com/macros/s/AKfycbwevP4BC_-9SP1_Wdl2OeXCI1ffWTYlVymimB62gxn2YF7YO6kvKph5Z4JOVRg6mpXn/exec',
  botUsername: 'PDF_Tools0_bot',
  defaultLang: 'en',
  editions: {
    global: { defaultLang: 'en' },
    local:  { defaultLang: 'so' }
  },
  version: '1.0.0'
};
