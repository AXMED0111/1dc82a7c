/**
 * APP #8 — FILE CONVERTER / PDF TOOLS
 * Apps Script project = Core.gs + this file. Script properties: BOT_TOKEN_converter, ADMIN_IDS.
 * Conversions run on the phone; the server only counts the 2 free conversions, checks the plan,
 * and sends finished files to the user's Telegram chat.
 */
var THIS_APP = { id: 'converter', url: 'https://axm-08.pages.dev', button: 'PDF Tools' };
var APP_DEFAULTS = APP_DEFAULTS || {};
APP_DEFAULTS.converter = { appName: 'PDF Tools', freeAllowance: 2, freeMaxMB: 10, paidMaxMB: 100 };
