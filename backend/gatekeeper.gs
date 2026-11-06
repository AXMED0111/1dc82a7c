/**
 * APP #1 — PAID-CHANNEL GATEKEEPER ("Channel Pass")
 * Creators add the bot as admin of their private channel/group (rights: Invite users via link + Ban users).
 * The bot creates a join-request link. Subscribers pay (Stars / USDT / local), the bot approves their
 * join request, and removes them automatically when the period ends. Platform keeps x_feePercent.
 * Needs Script property BOT_TOKEN_gatekeeper.
 */
var EXTRA_SCHEMA = EXTRA_SCHEMA || {};
var APP_HOOKS = APP_HOOKS || {};
var HOURLY_JOBS = HOURLY_JOBS || [];

EXTRA_SCHEMA.Channels = ['channel_key','channel_id','owner_id','title','username','description','invite_link','status','plans_json','payout','bot_ok','created_at'];
EXTRA_SCHEMA.Members  = ['channel_key','channel_id','user_id','plan','status','start_date','expiry_date','order_id','reminded'];

var GK = 'gatekeeper';

function gkChannelByKey(key) { return find('Channels', function (c) { return c.channel_key === key; }); }
function gkChannelById(id) { return find('Channels', function (c) { return String(c.channel_id) === String(id); }); }
function gkPlans(ch) { try { return JSON.parse(ch.plans_json || '[]'); } catch (e) { return []; } }
function gkSanitizePlans(list) {
  return (list || []).slice(0, 6).map(function (p, i) {
    return { id: String(p.id || ('p' + (i + 1))).replace(/[^\w-]/g, '').slice(0, 20) || ('p' + (i + 1)), label: String(p.label || '').slice(0, 40),
      days: Math.max(1, Math.min(3660, Number(p.days) || 30)), usd: Math.max(0, Number(p.usd) || 0), stars: Math.max(0, Math.round(Number(p.stars) || 0)) };
  }).filter(function (p) { return p.label && (p.usd > 0 || p.stars > 0); });
}
function gkActiveMember(key, uid) {
  var now = new Date(), best = null;
  rows('Members').forEach(function (m) {
    if (m.channel_key === key && String(m.user_id) === String(uid) && m.status === 'active' && new Date(m.expiry_date) > now)
      if (!best || new Date(m.expiry_date) > new Date(best.expiry_date)) best = m;
  });
  return best;
}
function gkPublic(ch) {
  return { key: ch.channel_key, title: ch.title, username: ch.username, description: ch.description, status: ch.status, plans: gkPlans(ch), botOk: ch.bot_ok === true || ch.bot_ok === 'TRUE' };
}
function gkRevenue(key) {
  var r = { usd: 0, stars: 0, orders: 0 };
  rows('Payments').forEach(function (p) {
    if (p.app !== GK || p.status !== 'paid' || String(p.plan).indexOf(key + '|') !== 0) return;
    r.orders++;
    if (p.currency === 'XTR') r.stars += Number(p.amount) || 0; else r.usd += Number(String(p.amount).replace(/[^\d.]/g, '')) || 0;
  });
  r.usd = Math.round(r.usd * 100) / 100;
  return r;
}
function gkMemberCount(key) { var now = new Date(); return rows('Members').filter(function (m) { return m.channel_key === key && m.status === 'active' && new Date(m.expiry_date) > now; }).length; }
function gkResolve(planStr) {
  var parts = String(planStr || '').split('|'), ch = gkChannelByKey(parts[0]);
  if (!ch || ch.status !== 'active') return null;
  var p = gkPlans(ch).filter(function (x) { return x.id === parts[1]; })[0];
  if (!p) return null;
  return { id: ch.channel_key + '|' + p.id, label: (ch.title + ' · ' + p.label).slice(0, 60), days: p.days, usd: p.usd, stars: p.stars, channel: ch };
}
function gkInviteButton(ch) { return { inline_keyboard: [[{ text: 'Join ' + String(ch.title).slice(0, 40), url: ch.invite_link }]] }; }

function gkActivate(ch, uid, planId, days, orderId) {
  var cur = gkActiveMember(ch.channel_key, uid), start = cur ? new Date(cur.expiry_date) : new Date(), exp = new Date(start.getTime() + days * 864e5);
  if (cur) update('Members', cur, { expiry_date: exp, plan: planId, order_id: orderId, reminded: '' });
  else append('Members', { channel_key: ch.channel_key, channel_id: String(ch.channel_id), user_id: String(uid), plan: planId, status: 'active', start_date: new Date(), expiry_date: exp, order_id: orderId, reminded: '' });
  var tok = botToken(GK);
  if (tok) {
    try { tgCall(tok, 'approveChatJoinRequest', { chat_id: ch.channel_id, user_id: Number(uid) }); } catch (e) {}
    try { tgCall(tok, 'sendMessage', { chat_id: uid, text: 'Access to ' + ch.title + ' is active until ' + exp.toISOString().slice(0, 10) + '. Tap below to join.', reply_markup: gkInviteButton(ch) }); } catch (e) {}
  }
  return exp;
}

APP_HOOKS.gatekeeper = {
  resolvePlan: function (ctx, planStr) { return gkResolve(planStr); },
  planForOrder: function (o) { return gkResolve(o.plan) || { days: 30 }; },
  onPaid: function (o, plan) {
    var ch = plan.channel || gkChannelByKey(String(o.plan).split('|')[0]);
    if (!ch) return '';
    var exp = gkActivate(ch, o.user_id, String(o.plan).split('|')[1], plan.days || 30, o.order_id);
    notify(GK, ch.owner_id, 'New subscriber in ' + ch.title + ' (' + o.method + ' ' + o.amount + ').');
    return exp;
  },
  routes: {
    gkMine: function (ctx) {
      var list = rows('Channels').filter(function (c) { return String(c.owner_id) === ctx.uid && c.status !== 'removed'; }).map(function (c) {
        var p = gkPublic(c); p.members = gkMemberCount(c.channel_key); p.revenue = gkRevenue(c.channel_key); p.payout = c.payout; return p; });
      return { ok: true, channels: list, feePercent: Number(ctx.st.x_feePercent) || 0 };
    },
    gkSave: function (ctx, req) {
      var ch = gkChannelByKey(req.key);
      if (!ch || (String(ch.owner_id) !== ctx.uid && !ctx.isAdmin)) return { ok: false, error: 'forbidden' };
      var upd = { description: String(req.description || '').slice(0, 500), plans_json: JSON.stringify(gkSanitizePlans(req.plans)), payout: String(req.payout || '').slice(0, 100) };
      if (req.status === 'active' || req.status === 'paused') upd.status = req.status;
      update('Channels', ch, upd);
      return { ok: true };
    },
    gkRefreshLink: function (ctx, req) {
      var ch = gkChannelByKey(req.key);
      if (!ch || String(ch.owner_id) !== ctx.uid) return { ok: false, error: 'forbidden' };
      var r = tgCall(botToken(GK), 'createChatInviteLink', { chat_id: ch.channel_id, creates_join_request: true, name: 'Paid access' });
      if (!r.ok) return { ok: false, error: 'telegram' };
      update('Channels', ch, { invite_link: r.result.invite_link });
      return { ok: true };
    },
    gkChannel: function (ctx, req) {
      var ch = gkChannelByKey(req.key);
      if (!ch || ch.status === 'removed') return { ok: false, error: 'not_found' };
      var m = gkActiveMember(ch.channel_key, ctx.uid);
      return { ok: true, channel: gkPublic(ch), member: m ? { expiry: iso(m.expiry_date), plan: m.plan } : null, inviteLink: m ? ch.invite_link : '' };
    },
    gkMySubs: function (ctx) {
      var now = new Date(), out = [];
      rows('Members').forEach(function (m) {
        if (String(m.user_id) !== ctx.uid || m.status !== 'active' || new Date(m.expiry_date) <= now) return;
        var ch = gkChannelByKey(m.channel_key); if (ch) out.push({ key: ch.channel_key, title: ch.title, expiry: iso(m.expiry_date), inviteLink: ch.invite_link });
      });
      return { ok: true, subs: out };
    },
    gkTestJoin: function (ctx, req) {
      if (!ctx.st.testMode) return { ok: false, error: 'forbidden' };
      var ch = gkChannelByKey(req.key); if (!ch || ch.status !== 'active') return { ok: false, error: 'not_found' };
      var p = gkPlans(ch)[0] || { id: 'test', days: 1 };
      gkActivate(ch, ctx.uid, p.id, p.days, 'TEST');
      return { ok: true };
    },
    adminGk: function (ctx) {
      if (!ctx.isAdmin) return { ok: false, error: 'forbidden' };
      var fee = Number(ctx.st.x_feePercent) || 0;
      return { ok: true, feePercent: fee, channels: rows('Channels').filter(function (c) { return c.status !== 'removed'; }).map(function (c) {
        var r = gkRevenue(c.channel_key);
        return { key: c.channel_key, title: c.title, owner: c.owner_id, payout: c.payout, members: gkMemberCount(c.channel_key), revenue: r,
          owedUsd: Math.round(r.usd * (100 - fee)) / 100, owedStars: Math.floor(r.stars * (100 - fee) / 100) }; }) };
    },
    adminGkFee: function (ctx, req) {
      if (!ctx.isAdmin) return { ok: false, error: 'forbidden' };
      var st = getSettings(GK); st.x_feePercent = Math.max(0, Math.min(50, Number(req.fee) || 0)); saveSettings(GK, st); return { ok: true };
    }
  },
  server: {
    // Bot was added/removed as admin of a channel or group (my_chat_member update)
    gkBotStatus: function (req) {
      var tok = botToken(GK), chat = req.chat || {}, ch = gkChannelById(chat.id);
      var admin = req.status === 'administrator', ok = admin && !!req.can_invite && !!req.can_restrict;
      if (!admin) { if (ch) update('Channels', ch, { status: 'removed', bot_ok: false }); return { ok: true }; }
      var link = ch && ch.invite_link;
      if (ok && !link) { var r = tgCall(tok, 'createChatInviteLink', { chat_id: chat.id, creates_join_request: true, name: 'Paid access' }); if (r.ok) link = r.result.invite_link; }
      if (ch) update('Channels', ch, { title: chat.title || ch.title, username: chat.username || '', status: ch.status === 'removed' ? 'paused' : ch.status, bot_ok: ok, invite_link: link || '' });
      else append('Channels', { channel_key: Utilities.getUuid().replace(/-/g, '').slice(0, 10), channel_id: String(chat.id), owner_id: String(req.from_id), title: chat.title || 'Channel',
        username: chat.username || '', description: '', invite_link: link || '', status: 'paused', plans_json: '[]', payout: '', bot_ok: ok, created_at: new Date() });
      notify(GK, req.from_id, ok ? (chat.title + ' is connected. Open the app to set your prices and publish it.')
        : ('Almost done: give the bot the rights "Invite users via link" and "Ban users" in ' + chat.title + '.'));
      return { ok: true };
    },
    // Someone tapped the join-request link
    gkJoinRequest: function (req) {
      var ch = gkChannelById(req.chat_id), st = getSettings(GK);
      if (!ch) return { ok: true, approve: false };
      if (gkActiveMember(ch.channel_key, req.user_id)) return { ok: true, approve: true };
      return { ok: true, approve: false, offer: ch.status === 'active', key: ch.channel_key, title: ch.title };
    }
  }
};

/* Hourly: remove expired members, remind 2 days before. */
HOURLY_JOBS.push(function gkExpiry() {
  var tok = botToken(GK); if (!tok) return;
  var now = new Date(), soon = new Date(now.getTime() + 2 * 864e5);
  rows('Members').forEach(function (m) {
    if (m.status !== 'active') return;
    var exp = new Date(m.expiry_date), ch = gkChannelByKey(m.channel_key);
    if (exp <= now) {
      if (gkActiveMember(m.channel_key, m.user_id)) { update('Members', m, { status: 'replaced' }); return; } // newer row exists
      try { tgCall(tok, 'banChatMember', { chat_id: m.channel_id, user_id: Number(m.user_id) }); tgCall(tok, 'unbanChatMember', { chat_id: m.channel_id, user_id: Number(m.user_id), only_if_banned: true }); } catch (e) {}
      update('Members', m, { status: 'expired' });
      if (ch) notify(GK, m.user_id, 'Your access to ' + ch.title + ' has ended. Open the app to renew.');
    } else if (exp <= soon && !m.reminded) {
      update('Members', m, { reminded: 'yes' });
      if (ch) notify(GK, m.user_id, 'Your access to ' + ch.title + ' ends on ' + exp.toISOString().slice(0, 10) + '. Open the app to renew.');
    }
  });
});
