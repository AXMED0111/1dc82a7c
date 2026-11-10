/* Public config only — NEVER put secrets here.
   This app runs on Cloudflare D1 (BACKEND=d1): no Google fallback, so no save can land in the old sheet. */
window.APP_CONFIG = { appId: 'control', apiUrl: '/api/app', directUrl: '', botUsername: 'MyControlCenter0_bot', appShortName: '', defaultLang: 'en', version: '2.0.0' };
