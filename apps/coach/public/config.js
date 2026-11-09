/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads). */
window.APP_CONFIG = {
  appId: 'coach',
  apiUrl: '/api/app',
  directUrl: 'https://script.google.com/macros/s/AKfycbyg_JsG7088QvR8HoipQu1IeNrhMAWLBssbMkZLS04jYuYp35Kqd91SbS9E-XP-3zHjMw/exec',
  botUsername: 'InterviewCoach0_bot',
  appShortName: '',
  defaultLang: 'en',
  version: '1.0.0'
};
