// Shared Telegram bot webhook (same file in every app; APP_ID decides the backend module). Secrets come ONLY from Netlify environment variables:
// BOT_TOKEN, WEBHOOK_SECRET, GAS_URL (Apps Script /exec URL), SERVER_SECRET, APP_ID, APP_URL
const env = (k) => (globalThis.Netlify ? Netlify.env.get(k) : process.env[k]) || '';

const tg = (method, body) =>
  fetch(`https://api.telegram.org/bot${env('BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  }).then((r) => r.json()).catch(() => ({ ok: false }));

const gas = (action, data) =>
  fetch(env('GAS_URL'), {
    method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, app: env('APP_ID') || 'converter', serverSecret: env('SERVER_SECRET'), ...data })
  }).then((r) => r.json()).catch(() => ({ ok: false, error: 'backend' }));

const TEXT = {
  start: 'Welcome. Tap the button below to open the app.',
  open: 'Open app',
  paysupport: 'For payment questions, reply here with your order ID and a short description. We answer within 24 hours.',
  terms: 'Purchases give access to premium features for the stated period. Digital goods are delivered immediately; refunds are handled case by case via /paysupport.',
  phoneOk: 'Thank you. Your phone number is verified. Return to the app to continue.',
  phoneNo: 'Thank you. Local payment methods are only available for supported countries.'
};

export default async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  if (!env('WEBHOOK_SECRET') || req.headers.get('x-telegram-bot-api-secret-token') !== env('WEBHOOK_SECRET'))
    return new Response('forbidden', { status: 403 });

  let u;
  try { u = await req.json(); } catch { return new Response('ok'); }

  // Stars: must answer within 10 seconds
  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    const r = await gas('precheckout', { order_id: q.invoice_payload, user_id: q.from.id, total: q.total_amount, currency: q.currency });
    const ok = !!(r.ok && r.valid);
    await tg('answerPreCheckoutQuery', ok ? { pre_checkout_query_id: q.id, ok: true }
      : { pre_checkout_query_id: q.id, ok: false, error_message: r.error || 'Order could not be verified.' });
    return new Response('ok');
  }

  // Bot added to / removed from a channel or group (used by the channel gatekeeper)
  if (u.my_chat_member) {
    const c = u.my_chat_member, nm = c.new_chat_member || {};
    await gas('gkBotStatus', { chat: c.chat, from_id: c.from.id, status: nm.status, can_invite: !!nm.can_invite_users, can_restrict: !!nm.can_restrict_members });
    return new Response('ok');
  }
  // Join request on a paid channel: approve members, send an offer to everyone else
  if (u.chat_join_request) {
    const j = u.chat_join_request;
    const r = await gas('gkJoinRequest', { chat_id: j.chat.id, user_id: j.from.id });
    if (r.approve) await tg('approveChatJoinRequest', { chat_id: j.chat.id, user_id: j.from.id });
    else if (r.offer) await tg('sendMessage', {
      chat_id: j.user_chat_id || j.from.id, text: `${r.title} is a paid channel. Choose a plan to get access.`,
      reply_markup: { inline_keyboard: [[{ text: 'View plans', web_app: { url: `${env('APP_URL')}?c=${encodeURIComponent(r.key)}` } }]] }
    });
    return new Response('ok');
  }

  const m = u.message;
  if (!m || !m.chat) return new Response('ok');
  const chat = m.chat.id;

  if (m.successful_payment) {
    const sp = m.successful_payment;
    await gas('starsPaid', { order_id: sp.invoice_payload, user_id: m.from.id, charge_id: sp.telegram_payment_charge_id, total: sp.total_amount });
    return new Response('ok');
  }

  if (m.contact) {
    if (m.contact.user_id === m.from.id) {
      const r = await gas('contact', { user_id: m.from.id, phone: m.contact.phone_number });
      await tg('sendMessage', { chat_id: chat, text: r.local ? TEXT.phoneOk : TEXT.phoneNo, reply_markup: { remove_keyboard: true } });
    }
    return new Response('ok');
  }

  const cmd = (m.text || '').split(/[\s@]/)[0];
  if (cmd === '/paysupport') await tg('sendMessage', { chat_id: chat, text: TEXT.paysupport });
  else if (cmd === '/terms') await tg('sendMessage', { chat_id: chat, text: TEXT.terms });
  else if (cmd === '/start' || m.text) {
    // /start c_KEY  -> open a specific channel offer
    const arg = cmd === '/start' ? (m.text.split(/\s+/)[1] || '') : '';
    const url = /^c_[\w]+$/.test(arg) ? `${env('APP_URL')}?c=${arg.slice(2)}` : env('APP_URL');
    await tg('sendMessage', {
      chat_id: chat, text: TEXT.start,
      reply_markup: { inline_keyboard: [[{ text: TEXT.open, web_app: { url } }]] }
    });
  }
  return new Response('ok');
};

export const config = { path: '/api/telegram' };
