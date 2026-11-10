/* PDF Tools on Cloudflare D1. Conversions run on the phone; the server counts free uses (consume), checks the plan and
   sends finished files to the user's Telegram chat (/api/file). Everything is in the shared engine. */
export default {
  id: 'converter', url: 'https://axm-08.pages.dev', button: 'PDF Tools',
  defaults: { appName: 'PDF Tools', freeAllowance: 2, freeMaxMB: 10, paidMaxMB: 100 },
  routes: {}
};
