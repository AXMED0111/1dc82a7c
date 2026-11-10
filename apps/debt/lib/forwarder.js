// Telegram webhook forwarder (Cloudflare Pages Function). Holds NO secrets of its own.
// It forwards Telegram's update and Telegram's secret header to the app's Apps Script backend,
// which verifies the header (WEBHOOK_SECRET_<app>) and replies to Telegram with its own bot token.
// Edge copy (functions/api/app.js): once Apps Script has ACCEPTED an update, the header is known to be genuine,
// so it is remembered in D1 (meta.whsec) to check the signed passes Apps Script gives to phones.
// Payments and channel changes mark every saved copy of this app as "check again".
// Cloudflare variables (not secret): GAS_URL = Apps Script /exec URL, APP_ID. Binding: DB (D1, optional).
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response('ok');
  let update; try { update = await request.json(); } catch { return new Response('ok'); }
  const whSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!whSecret || !env.GAS_URL) return new Response('forbidden', { status: 403 });
  const app = env.APP_ID || '';
  try {
    const r = await fetch(env.GAS_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ tgUpdate: update, whSecret, app }) });
    let o = null; try { o = JSON.parse(await r.text()); } catch {}
    const edge = env.EDGE || env.DB;
    if (edge && app && o && o.ok === true) {
      const m = update.message || {}, changes = !!(update.pre_checkout_query || m.successful_payment || update.my_chat_member || update.chat_join_request || m.contact);
      const job = edge.prepare('INSERT INTO meta (app, ep, whsec) VALUES (?, 0, ?) ON CONFLICT(app) DO UPDATE SET whsec = excluded.whsec' + (changes ? ', ep = ep + 1' : '')).bind(app, whSecret).run();
      await job.catch(() => {});   // small write; awaited so it never depends on background-task support
    }
  } catch (e) {}
  return new Response('ok');
}
