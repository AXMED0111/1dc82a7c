/* Channel Pass on Cloudflare D1 — the D1 twin of apps/gatekeeper/apps-script/Gatekeeper.gs (same actions, same answers).
 * Creators add the bot as admin of their private channel/group (rights: Invite users via link + Ban users).
 * The bot creates a join-request link. Subscribers pay (Stars / USDT / local), the bot approves their join request
 * and removes them when the period ends. Platform keeps x_feePercent. Every query is indexed. */
const GK = 'gatekeeper';
const yes = (v) => v === true || v === 1 || v === '1' || v === 'TRUE' || v === 'true';
const nowIso = () => new Date().toISOString();
const plansOf = (ch) => { try { return JSON.parse(ch.plans_json || '[]'); } catch (e) { return []; } };
function cleanPlans(list) {
  return (list || []).slice(0, 6).map((p, i) => ({ id: String(p.id || ('p' + (i + 1))).replace(/[^\w-]/g, '').slice(0, 20) || ('p' + (i + 1)), label: String(p.label || '').slice(0, 40),
    days: Math.max(1, Math.min(3660, Number(p.days) || 30)), usd: Math.max(0, Number(p.usd) || 0), stars: Math.max(0, Math.round(Number(p.stars) || 0)) })).filter((p) => p.label && (p.usd > 0 || p.stars > 0));
}
const byKey = (E, k) => E.db.one('Channels', { channel_key: String(k || '') });
const byChatId = (E, id) => E.db.one('Channels', { channel_id: String(id) });
const activeMember = (E, key, uid) => E.db.one('Members', { channel_key: key, user_id: String(uid), status: 'active' }, { where: '"expiry_date" > ?', args: [nowIso()], order: '"expiry_date" DESC' });
const pub = (ch) => ({ key: ch.channel_key, title: ch.title, username: ch.username, description: ch.description, status: ch.status, plans: plansOf(ch), botOk: yes(ch.bot_ok) });
const graceOf = (ch) => Math.max(0, Math.min(7, Math.round(Number(ch && ch.grace_days) || 0)));   // days of "last chance" after the end (0 = removed at once)
async function owned(ctx, key) { const ch = await byKey(ctx.E, key); return ch && (String(ch.owner_id) === ctx.uid || ctx.isAdmin) ? ch : null; }
const inviteButton = (ch) => ({ inline_keyboard: [[{ text: 'Join ' + String(ch.title).slice(0, 40), url: ch.invite_link }]] });
const renewButton = (A, ch) => ({ inline_keyboard: [[{ text: 'Renew', web_app: { url: A.APP_URL + '?c=' + ch.channel_key } }]] });
async function resolve(E, planStr, anyStatus) {
  const parts = String(planStr || '').split('|'), ch = await byKey(E, parts[0]);
  if (!ch || (!anyStatus && ch.status !== 'active')) return null;
  const p = plansOf(ch).filter((x) => x.id === parts[1])[0]; if (!p) return null;
  return { id: ch.channel_key + '|' + p.id, label: (ch.title + ' · ' + p.label).slice(0, 60), days: p.days, usd: p.usd, stars: p.stars, channel: ch };
}
/* members + revenue for several channels in one database round (paid orders found by the indexed plan range "key|…") */
async function numbers(E, chans) {
  if (!chans.length) return [];
  const db = E.db.app, now = nowIso(), stmts = [];
  chans.forEach((c) => {
    stmts.push(db.prepare('SELECT COUNT(*) AS n FROM "Members" WHERE "channel_key" = ? AND "status" = \'active\' AND "expiry_date" > ?').bind(c.channel_key, now));
    stmts.push(db.prepare('SELECT "currency", "amount" FROM "Payments" WHERE "plan" >= ? AND "plan" < ? AND "app" = ? AND "status" = \'paid\'').bind(c.channel_key + '|', c.channel_key + '}', GK));
  });
  const out = await db.batch(stmts);
  return chans.map((c, i) => {
    const r = { usd: 0, stars: 0, orders: 0 };
    (out[2 * i + 1].results || []).forEach((p) => { r.orders++; if (p.currency === 'XTR') r.stars += Number(p.amount) || 0; else r.usd += Number(String(p.amount).replace(/[^\d.]/g, '')) || 0; });
    r.usd = Math.round(r.usd * 100) / 100;
    return { members: Number(((out[2 * i].results || [])[0] || {}).n) || 0, revenue: r };
  });
}
async function activate(A, E, ch, uid, planId, days, orderId) {
  let exp;
  for (let i = 0; i < 3; i++) {   // extend the current period; if two payments land at once, neither extension is lost
    let cur = await activeMember(E, ch.channel_key, uid);
    if (!cur) {   // in the "last chance" days: renew the same membership from its old end date
      const g = await E.db.one('Members', { channel_key: ch.channel_key, user_id: String(uid), status: 'grace' }, { order: '"expiry_date" DESC' });
      if (g) { const base = new Date(g.expiry_date).getTime() + days * 864e5; exp = new Date(base > Date.now() ? base : Date.now() + days * 864e5);
        const c = await E.db.run('Members', 'UPDATE "Members" SET "status" = \'active\', "expiry_date" = ?, "plan" = ?, "order_id" = ?, "reminded" = \'\', "grace_until" = \'\' WHERE rowid = ? AND "status" = \'grace\'', A.iso(exp), planId, orderId, g._id);
        if (c.meta && c.meta.changes) break; continue; }
    }
    const start = cur ? new Date(cur.expiry_date) : new Date(); exp = new Date(start.getTime() + days * 864e5);
    if (!cur) { await E.db.ins('Members', { channel_key: ch.channel_key, channel_id: String(ch.channel_id), user_id: String(uid), plan: planId, status: 'active', start_date: new Date(), expiry_date: exp, order_id: orderId, reminded: '' }); break; }
    const c = await E.db.run('Members', 'UPDATE "Members" SET "expiry_date" = ?, "plan" = ?, "order_id" = ?, "reminded" = \'\' WHERE rowid = ? AND "expiry_date" = ?', A.iso(exp), planId, orderId, cur._id, cur.expiry_date);
    if (c.meta && c.meta.changes) break;
  }
  const tok = await A.botToken(E);
  if (tok) {
    await A.tgCall(tok, 'approveChatJoinRequest', { chat_id: ch.channel_id, user_id: Number(uid) });
    await A.tgCall(tok, 'sendMessage', { chat_id: uid, text: 'Access to ' + ch.title + ' is active until ' + exp.toISOString().slice(0, 10) + '. Tap below to join.', reply_markup: inviteButton(ch) });
  }
  return exp;
}
async function removeFromChat(A, tok, chatId, uid) {   // ban + unban = removed, but free to come back after paying again
  await A.tgCall(tok, 'banChatMember', { chat_id: chatId, user_id: Number(uid) });
  await A.tgCall(tok, 'unbanChatMember', { chat_id: chatId, user_id: Number(uid), only_if_banned: true });
}
async function queueMany(E, msgs) {   // many messages into the central Outbox in a few database rounds (sent 40 every 5 minutes)
  const stmts = msgs.map((m) => E.db.insStmt('Outbox', { msg_id: crypto.randomUUID().slice(0, 12), app: GK, chat_id: String(m.chat), text: String(m.text).slice(0, 4000), markup: m.markup ? JSON.stringify(m.markup) : '', status: 'queued', created_at: new Date() }));
  for (let i = 0; i < stmts.length; i += 50) await E.db.d('Outbox').batch(stmts.slice(i, i + 50));
}

export default {
  id: GK, url: 'https://axm-01.pages.dev', button: 'Channel Pass',
  defaults: { appName: 'Channel Pass', freeAllowance: 0, x_feePercent: 5, plans: [], x_refOn: false },
  schema: {
    Channels: ['channel_key', 'channel_id', 'owner_id', 'title', 'username', 'description', 'invite_link', 'status', 'plans_json', 'payout', 'bot_ok', 'created_at', 'grace_days'],
    Members: ['channel_key', 'channel_id', 'user_id', 'plan', 'status', 'start_date', 'expiry_date', 'order_id', 'reminded', 'grace_until']
  },
  indexes: {
    Channels: [[['channel_key'], true], [['channel_id']], [['owner_id']]],
    Members: [[['channel_key', 'user_id']], [['user_id']], [['status', 'expiry_date']]],
    Payments: [[['plan']]]
  },
  async resolvePlan(ctx, planStr) { return resolve(ctx.E, planStr, false); },
  async planForOrder(o, A, E) { return (await resolve(E, o.plan, true)) || { days: 30 }; },   // paid is paid, even if the creator paused sales meanwhile
  async onPaid(o, plan, A, E) {
    const ch = plan.channel || await byKey(E, String(o.plan).split('|')[0]); if (!ch) return '';
    const exp = await activate(A, E, ch, o.user_id, String(o.plan).split('|')[1], plan.days || 30, o.order_id);
    await A.notify(E, ch.owner_id, 'New subscriber in ' + ch.title + ' (' + o.method + ' ' + o.amount + ').');
    return exp;
  },
  async onRefund(o, A, E) {   // the membership bought with a refunded payment ends
    const m = await E.db.one('Members', { order_id: o.order_id }); if (!m) return;
    await E.db.upd('Members', m, { status: 'stopped', expiry_date: new Date() });
    const tok = await A.botToken(E); if (tok) await removeFromChat(A, tok, m.channel_id, m.user_id);
  },
  async extraSubs(A, E) { return E.db.count('Members', { status: 'active' }, { where: '"expiry_date" > ?', args: [nowIso()] }); },   // paying members count as subscriptions in the central numbers
  routes: {
    async gkMine(ctx) {
      const chans = (await ctx.E.db.sel('Channels', { owner_id: ctx.uid })).filter((c) => c.status !== 'removed'), nums = await numbers(ctx.E, chans);
      return { ok: true, channels: chans.map((c, i) => Object.assign(pub(c), nums[i], { payout: c.payout, graceDays: graceOf(c) })), feePercent: Number(ctx.st.x_feePercent) || 0 };
    },
    async gkSave(ctx, req) {
      const ch = await byKey(ctx.E, req.key); if (!ch || (String(ch.owner_id) !== ctx.uid && !ctx.isAdmin)) return { ok: false, error: 'forbidden' };
      const upd = { description: String(req.description || '').slice(0, 500), plans_json: JSON.stringify(cleanPlans(req.plans)), payout: String(req.payout || '').slice(0, 100) };
      if (req.status === 'active' || req.status === 'paused') upd.status = req.status;
      if (req.graceDays !== undefined) upd.grace_days = graceOf({ grace_days: req.graceDays });
      await ctx.E.db.upd('Channels', ch, upd);
      return { ok: true };
    },
    async gkRefreshLink(ctx, req, A) {
      const E = ctx.E, ch = await byKey(E, req.key); if (!ch || String(ch.owner_id) !== ctx.uid) return { ok: false, error: 'forbidden' };
      const r = await A.tgCall(await A.botToken(E), 'createChatInviteLink', { chat_id: ch.channel_id, creates_join_request: true, name: 'Paid access' });
      if (!r.ok) return { ok: false, error: 'telegram' };
      await E.db.upd('Channels', ch, { invite_link: r.result.invite_link });
      return { ok: true };
    },
    async gkChannel(ctx, req, A) {
      const ch = await byKey(ctx.E, req.key); if (!ch || ch.status === 'removed') return { ok: false, error: 'not_found' };
      const m = await activeMember(ctx.E, ch.channel_key, ctx.uid);
      return { ok: true, channel: pub(ch), member: m ? { expiry: A.iso(m.expiry_date), plan: m.plan } : null, inviteLink: m ? ch.invite_link : '' };
    },
    async gkMySubs(ctx, req, A) {
      const E = ctx.E, ms = await E.db.sel('Members', { user_id: ctx.uid, status: 'active' }, { where: '"expiry_date" > ?', args: [nowIso()] });
      const keys = [...new Set(ms.map((m) => m.channel_key))], chans = {};
      for (let i = 0; i < keys.length; i += 90) { const part = keys.slice(i, i + 90); (await E.db.sel('Channels', {}, { where: '"channel_key" IN (' + part.map(() => '?').join(',') + ')', args: part })).forEach((c) => { chans[c.channel_key] = c; }); }
      return { ok: true, subs: ms.filter((m) => chans[m.channel_key]).map((m) => { const ch = chans[m.channel_key]; return { key: ch.channel_key, title: ch.title, expiry: A.iso(m.expiry_date), inviteLink: ch.invite_link }; }) };
    },
    async gkTestJoin(ctx, req, A) {
      if (!ctx.st.testMode) return { ok: false, error: 'forbidden' };
      const ch = await byKey(ctx.E, req.key); if (!ch || ch.status !== 'active') return { ok: false, error: 'not_found' };
      const p = plansOf(ch)[0] || { id: 'test', days: 1 };
      await activate(A, ctx.E, ch, ctx.uid, p.id, p.days, 'TEST');
      return { ok: true };
    },
    // ---- creator tools: member list, notify, extend, stop, broadcast ----
    async gkMembers(ctx, req, A) {
      const E = ctx.E, ch = await owned(ctx, req.key); if (!ch) return { ok: false, error: 'forbidden' };
      const latest = {};   // newest row per user
      const live = (m) => (m.status === 'active' && new Date(m.expiry_date) > new Date() ? 2 : m.status === 'grace' ? 1 : 0);   // the current membership wins over old rows
      (await E.db.sel('Members', { channel_key: ch.channel_key })).forEach((m) => { const k = String(m.user_id), o = latest[k]; if (!o || live(m) > live(o) || (live(m) === live(o) && new Date(m.expiry_date) > new Date(o.expiry_date))) latest[k] = m; });
      const ids = Object.keys(latest), names = {};
      for (let i = 0; i < ids.length; i += 90) {
        const part = ids.slice(i, i + 90);
        (await E.db.sel('Users', { app: GK }, { where: '"user_id" IN (' + part.map(() => '?').join(',') + ')', args: part })).forEach((u) => { names[String(u.user_id)] = { name: u.first_name || '', username: u.username || '' }; });
      }
      const now = Date.now();
      return { ok: true, channel: { key: ch.channel_key, title: ch.title }, members: ids.map((k) => {
        const m = latest[k], exp = new Date(m.expiry_date), n = names[k] || {}, st = m.status === 'active' && exp.getTime() > now ? 'active' : m.status === 'grace' ? 'grace' : m.status === 'stopped' ? 'stopped' : 'expired';
        return { user_id: k, name: n.name || ('User ' + k.slice(-4)), username: n.username, plan: m.plan, start: A.iso(m.start_date), expiry: A.iso(exp), status: st, daysLeft: Math.ceil((exp.getTime() - now) / 864e5), graceUntil: st === 'grace' ? A.iso(m.grace_until) : '' };
      }).sort((a, b) => { const o = { active: 0, grace: 1, stopped: 2, expired: 3 }; return o[a.status] - o[b.status] || new Date(a.expiry) - new Date(b.expiry); }) };
    },
    async gkMemberAction(ctx, req, A) {
      const E = ctx.E, ch = await owned(ctx, req.key); if (!ch) return { ok: false, error: 'forbidden' };
      const uid = String(req.user_id), tok = await A.botToken(E);
      if (req.op === 'notify') {
        const text = String(req.text || '').trim().slice(0, 1000); if (!text) return { ok: false, error: 'empty' };
        const r = await A.tgCall(tok, 'sendMessage', { chat_id: uid, text: ch.title + ':\n' + text }); return r.ok ? { ok: true } : { ok: false, error: r.error_code === 403 ? 'blocked_bot' : 'telegram' };
      }
      if (req.op === 'extend') {
        const days = Math.max(1, Math.min(365, Math.round(Number(req.days) || 0)));
        if (!(await E.db.one('Members', { channel_key: ch.channel_key, user_id: uid }))) return { ok: false, error: 'not_member' };
        const m = await activeMember(E, ch.channel_key, uid), base = m ? new Date(m.expiry_date) : new Date(), exp = new Date(base.getTime() + days * 864e5);
        if (m) await E.db.upd('Members', m, { expiry_date: exp, reminded: '' });
        else await E.db.ins('Members', { channel_key: ch.channel_key, channel_id: String(ch.channel_id), user_id: uid, plan: 'gift', status: 'active', start_date: new Date(), expiry_date: exp, order_id: 'GIFT-' + ctx.uid, reminded: '' });
        await A.tgCall(tok, 'approveChatJoinRequest', { chat_id: ch.channel_id, user_id: Number(uid) });
        E.defer(A.notify(E, uid, 'The admin of ' + ch.title + ' extended your access by ' + days + ' days, until ' + exp.toISOString().slice(0, 10) + '.' + (m ? '' : ' Join: ' + ch.invite_link)));
        E.defer(A.log(E, ctx.uid, 'member_extend', ch.channel_key + ' ' + uid + ' +' + days));
        return { ok: true, expiry: A.iso(exp) };
      }
      if (req.op === 'stop') {
        await E.db.run('Members', 'UPDATE "Members" SET "status" = \'stopped\', "expiry_date" = ? WHERE "channel_key" = ? AND "user_id" = ? AND "status" IN (\'active\', \'grace\')', nowIso(), ch.channel_key, uid);
        if (tok) await removeFromChat(A, tok, ch.channel_id, uid);
        if (req.tell !== false) E.defer(A.notify(E, uid, 'Your access to ' + ch.title + ' was ended by the channel admin.' + (req.reason ? ' Reason: ' + String(req.reason).slice(0, 200) : '')));
        E.defer(A.log(E, ctx.uid, 'member_stop', ch.channel_key + ' ' + uid));
        return { ok: true };
      }
      return { ok: false, error: 'op' };
    },
    // creator discount codes for their own buyers (scope ch:<key>)
    async gkCodes(ctx, req, A) { const ch = await owned(ctx, req.key); if (!ch) return { ok: false, error: 'forbidden' }; return { ok: true, codes: (await ctx.E.db.sel('Codes', { app: GK, scope: 'ch:' + ch.channel_key })).map(A.codeOut) }; },
    async gkCodeSave(ctx, req, A) { const ch = await owned(ctx, req.key); if (!ch) return { ok: false, error: 'forbidden' }; return A.codeSave(ctx, req, 'ch:' + ch.channel_key); },
    async gkCodeToggle(ctx, req, A) { const ch = await owned(ctx, req.key); if (!ch) return { ok: false, error: 'forbidden' }; return A.codeToggle(ctx, req, 'ch:' + ch.channel_key); },
    async gkBroadcast(ctx, req, A) {
      const E = ctx.E, ch = await owned(ctx, req.key); if (!ch) return { ok: false, error: 'forbidden' };
      const text = String(req.text || '').trim().slice(0, 1500); if (!text) return { ok: false, error: 'empty' };
      const now = Date.now(), soon = new Date(now + 3 * 864e5).toISOString(), seen = new Set();
      (await E.db.sel('Members', { channel_key: ch.channel_key, status: 'active' }, { where: '"expiry_date" > ?' + (req.audience === 'expiring' ? ' AND "expiry_date" <= ?' : ''), args: req.audience === 'expiring' ? [new Date(now).toISOString(), soon] : [new Date(now).toISOString()] }))
        .forEach((m) => seen.add(String(m.user_id)));
      await queueMany(E, [...seen].map((uid) => ({ chat: uid, text: ch.title + ':\n' + text })));
      E.defer(A.log(E, ctx.uid, 'broadcast', ch.channel_key + ' ' + seen.size));
      return { ok: true, queued: seen.size };
    },
    async adminGk(ctx) {
      const fee = Number(ctx.st.x_feePercent) || 0, chans = (await ctx.E.db.sel('Channels', {})).filter((c) => c.status !== 'removed'), nums = await numbers(ctx.E, chans);
      return { ok: true, feePercent: fee, channels: chans.map((c, i) => ({ key: c.channel_key, title: c.title, owner: c.owner_id, payout: c.payout, members: nums[i].members, revenue: nums[i].revenue,
        owedUsd: Math.round(nums[i].revenue.usd * (100 - fee)) / 100, owedStars: Math.floor(nums[i].revenue.stars * (100 - fee) / 100) })) };
    },
    async adminGkFee(ctx, req, A) {
      const st = await A.getSettings(ctx.E); st.x_feePercent = Math.max(0, Math.min(50, Number(req.fee) || 0)); await A.saveSettings(ctx.E, st); return { ok: true };
    }
  },
  server: {
    // Bot was added/removed as admin of a channel or group (my_chat_member update)
    async gkBotStatus(req, A, E) {
      const tok = await A.botToken(E), chat = req.chat || {}, ch = await byChatId(E, chat.id);
      const admin = req.status === 'administrator', ok = admin && !!req.can_invite && !!req.can_restrict;
      if (!admin) { if (ch) await E.db.upd('Channels', ch, { status: 'removed', bot_ok: false }); return { ok: true }; }
      let link = ch && ch.invite_link;
      if (ok && !link) { const r = await A.tgCall(tok, 'createChatInviteLink', { chat_id: chat.id, creates_join_request: true, name: 'Paid access' }); if (r.ok) link = r.result.invite_link; }
      if (ch) await E.db.upd('Channels', ch, { title: chat.title || ch.title, username: chat.username || '', status: ch.status === 'removed' ? 'paused' : ch.status, bot_ok: ok, invite_link: link || '' });
      else await E.db.ins('Channels', { channel_key: crypto.randomUUID().replace(/-/g, '').slice(0, 10), channel_id: String(chat.id), owner_id: String(req.from_id), title: chat.title || 'Channel',
        username: chat.username || '', description: '', invite_link: link || '', status: 'paused', plans_json: '[]', payout: '', bot_ok: ok, created_at: new Date() });
      await A.notify(E, req.from_id, ok ? (chat.title + ' is connected. Open the app to set your prices and publish it.')
        : ('Almost done: give the bot the rights "Invite users via link" and "Ban users" in ' + chat.title + '.'));
      return { ok: true };
    },
    // Someone tapped the join-request link
    async gkJoinRequest(req, A, E) {
      const ch = await byChatId(E, req.chat_id); if (!ch) return { ok: true, approve: false };
      if (await activeMember(E, ch.channel_key, req.user_id)) return { ok: true, approve: true };
      return { ok: true, approve: false, offer: ch.status === 'active', key: ch.channel_key, title: ch.title };
    }
  },
  /* Hourly: reminders 5 and 2 days before the end; at the end either a "last chance" of N days (creator's choice) or removal.
     Only rows that are due are read (index on status + expiry). Telegram removals are capped per run (50 web calls per run on the free plan). */
  hourly: [async function gkExpiry(A, E) {
    const tok = await A.botToken(E); if (!tok) return;
    const now = new Date(), nowIso2 = now.toISOString(), in5 = new Date(now.getTime() + 5 * 864e5).toISOString();
    const [due, graceOver] = await Promise.all([
      E.db.sel('Members', { status: 'active' }, { where: '"expiry_date" <= ?', args: [in5], order: '"expiry_date"', limit: 500 }),
      E.db.sel('Members', { status: 'grace' }, { where: '"grace_until" <= ?', args: [nowIso2], limit: 200 })]);
    if (!due.length && !graceOver.length) return;
    const keys = [...new Set(due.concat(graceOver).map((m) => m.channel_key))], chans = {};
    for (let i = 0; i < keys.length; i += 90) { const part = keys.slice(i, i + 90); (await E.db.sel('Channels', {}, { where: '"channel_key" IN (' + part.map(() => '?').join(',') + ')', args: part })).forEach((c) => { chans[c.channel_key] = c; }); }
    const msgs = [], day10 = (d) => d.toISOString().slice(0, 10); let removals = 0;
    const remove = async (m, ch) => {   // out of the channel, told how to come back
      if (removals >= 20) return false; removals++;
      const c = await E.db.run('Members', 'UPDATE "Members" SET "status" = \'expired\' WHERE rowid = ? AND "status" IN (\'active\', \'grace\')', m._id); if (!c.meta || !c.meta.changes) return true;
      await removeFromChat(A, tok, m.channel_id, m.user_id);
      if (ch) msgs.push({ chat: m.user_id, text: 'Your access to ' + ch.title + ' has ended and you were removed from the channel. Open the app to join again.', markup: renewButton(A, ch) });
      return true;
    };
    for (const m of graceOver) {
      if (await activeMember(E, m.channel_key, m.user_id)) { await E.db.upd('Members', m, { status: 'replaced' }); continue; }
      await remove(m, chans[m.channel_key]);
    }
    for (const m of due) {
      const exp = new Date(m.expiry_date), ch = chans[m.channel_key], left = exp - now, len = exp - new Date(m.start_date || exp), sent = String(m.reminded || '');
      if (exp <= now) {
        if (await activeMember(E, m.channel_key, m.user_id)) { await E.db.upd('Members', m, { status: 'replaced' }); continue; }   // newer row exists
        const g = graceOf(ch);
        if (g > 0) {   // last chance: stays in the channel for g more days
          const until = new Date(exp.getTime() + g * 864e5);
          const c = await E.db.run('Members', 'UPDATE "Members" SET "status" = \'grace\', "grace_until" = ? WHERE rowid = ? AND "status" = \'active\'', until.toISOString(), m._id);
          if (c.meta && c.meta.changes && ch) msgs.push({ chat: m.user_id, text: 'Your access to ' + ch.title + ' has ended. Last chance: renew within ' + (g === 1 ? '1 day' : g + ' days') + ' (until ' + day10(until) + ') to stay in the channel.', markup: renewButton(A, ch) });
        } else await remove(m, ch);
      } else if (left <= 2 * 864e5 && !/2|yes/.test(sent)) {
        await E.db.upd('Members', m, { reminded: '5,2' });
        if (ch && len >= 4 * 864e5) msgs.push({ chat: m.user_id, text: 'Reminder: your access to ' + ch.title + ' ends on ' + day10(exp) + (left <= 864e5 ? ' (tomorrow or sooner)' : ' (in 2 days)') + '. Tap below to renew.', markup: renewButton(A, ch) });
      } else if (left > 2 * 864e5 && !/5|yes/.test(sent)) {
        await E.db.upd('Members', m, { reminded: '5' });
        if (ch && len >= 10 * 864e5) msgs.push({ chat: m.user_id, text: 'Your access to ' + ch.title + ' ends in 5 days, on ' + day10(exp) + '. Renew now to keep it without a break.', markup: renewButton(A, ch) });
      }
    }
    await queueMany(E, msgs);
  }]
};
