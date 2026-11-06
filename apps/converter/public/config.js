/* Edition config. Public values only — NEVER put secrets here.
   apiUrl: Google Apps Script Web App URL (leave empty = DEMO mode, settings saved on device only). */
window.APP_CONFIG = {
  appId: 'converter',
  apiUrl: '',
  botUsername: '',
  defaultLang: 'en',
  editions: {
    global: { defaultLang: 'en' },
    local:  { defaultLang: 'so' }
  },
  version: '1.0.0'
};
