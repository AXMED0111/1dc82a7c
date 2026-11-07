// Telegram webhook forwarder (Cloudflare Pages Function). Holds NO secrets.
// It forwards Telegram's update and Telegram's secret header to the app's Apps Script backend,
// which verifies the header (WEBHOOK_SECRET_<app>) and replies to Telegram with its own bot token.
// Cloudflare variables (not secret): GAS_URL = Apps Script /exec URL.
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response('ok');
  let update; try { update = await request.json(); } catch { return new Response('ok'); }
  const whSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!whSecret || !env.GAS_URL) return new Response('forbidden', { status: 403 });
  try {
    await fetch(env.GAS_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ tgUpdate: update, whSecret, app: env.APP_ID || '' }) });
  } catch (e) {}
  return new Response('ok');
}
