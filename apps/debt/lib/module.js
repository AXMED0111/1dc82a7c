/* Debt Book on Cloudflare D1 — the D1 twin of apps/debt/apps-script/Debt.gs (same actions, same answers).
 * Every query is scoped by owner_id / cust_id / token (indexed): no table scans in requests. */
const TYPES = ['debt', 'payment', 'income', 'expense'], METHODS = ['cash', 'mobile', 'bank', 'card', 'other'];
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const id = (p) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const money = (n, cur) => (cur === 'USD' ? '$' + n.toFixed(2).replace(/\.00$/, '') : n + ' ' + cur);
const entryOut = (e) => ({ id: e.entry_id, type: e.type, amount: Number(e.amount) || 0, date: day(e.date), due: day(e.due), note: e.note || '', category: e.category || '', method: e.method || '' });

function sum(c, entries, iso) {
  let bal = 0; const dues = [], list = entries.map((e) => { const a = Number(e.amount) || 0; bal += e.type === 'debt' ? a : -a; if (e.type === 'debt' && e.due) dues.push(day(e.due)); return entryOut(e); });
  dues.sort(); const due = bal > 0 ? dues[0] || '' : '', today = day(new Date());
  return { id: c.cust_id, name: c.name, phone: c.phone, token: c.token, linked: !!c.tg_chat, reminded: c.last_reminded ? iso(c.last_reminded) : '', entries: list, balance: Math.round(bal * 100) / 100, dueDate: due, overdue: !!due && due < today };
}
async function shopOf(E, uid) {
  const r = await E.db.one('Shops', { owner_id: String(uid) });
  return r ? { name: r.name, currency: r.currency || 'USD', freq: r.freq || 'off', lang: r.lang || 'so', country: r.country || '', _r: r } : { name: '', currency: 'USD', freq: 'off', lang: 'so', country: '' };
}
const ownCust = async (ctx, cid) => { const c = await ctx.E.db.one('Customers', { cust_id: String(cid || ''), owner_id: ctx.uid }); return c && c.status !== 'deleted' ? c : null; };
const custOut = async (E, c, iso) => sum(c, await E.db.sel('Entries', { cust_id: c.cust_id }), iso);
function reminder(c, shop) {
  const bal = money(c.balance, shop.currency);
  return shop.lang === 'so'
    ? 'Asc ' + c.name + ', tani waa xusuusin saaxiibtinimo oo ka timid ' + shop.name + '. Haraagaagu waa ' + bal + (c.dueDate ? ', waqtiga bixintu waa ' + c.dueDate : '') + '. Mahadsanid ganacsigaaga.'
    : 'Hello ' + c.name + ', this is a friendly reminder from ' + shop.name + '. Your balance is ' + bal + (c.dueDate ? ', due on ' + c.dueDate : '') + '. Thank you for your business.';
}
const tierOf = (st, sub) => (st.testMode ? 'business' : !sub ? 'free' : /^biz/.test(String(sub.plan)) ? 'business' : 'pro');
async function tier(ctx, A) { const a = await A.accessFor(ctx); return a.reason === 'test' ? 'business' : a.reason === 'sub' ? (/^biz/.test(String(a.plan)) ? 'business' : 'pro') : 'free'; }
function period(p) {
  const n = new Date(), y = n.getUTCFullYear(), m = n.getUTCMonth(), f = (d) => d.toISOString().slice(0, 10);
  if (p === 'lastmonth') return { from: f(new Date(Date.UTC(y, m - 1, 1))), to: f(new Date(Date.UTC(y, m, 0))) };
  if (p === 'year') return { from: y + '-01-01', to: f(n) };
  if (p === 'all') return { from: '0000-01-01', to: '9999-12-31' };
  return { from: f(new Date(Date.UTC(y, m, 1))), to: f(n) };
}
async function buildReport(E, uid, per, onlyCust, iso) {
  const P = period(per), [shop, all, custRows] = await Promise.all([shopOf(E, uid), E.db.sel('Entries', { owner_id: String(uid) }), E.db.sel('Customers', { owner_id: String(uid) })]), byCust = {}, cat = {}, meth = {}, inP = (d) => d >= P.from && d <= P.to;
  all.forEach((e) => { if (e.cust_id) (byCust[e.cust_id] = byCust[e.cust_id] || []).push(e); });
  const out = { shop: { name: shop.name, currency: shop.currency }, period: per, from: P.from, to: P.to,
    totals: { credit: 0, paid: 0, outstanding: 0, overdueCount: 0, overdueAmount: 0, customers: 0, income: 0, expense: 0, sales: 0, profit: 0, cashIn: 0, net: 0 }, customers: [], entries: [], byCategory: [], byMethod: [] };
  for (const c of custRows) {
    if (c.status === 'deleted' || (onlyCust && c.cust_id !== onlyCust)) continue;
    const sm = sum(c, byCust[c.cust_id] || [], iso); let credit = 0, paid = 0;
    sm.entries.forEach((e) => { if (!inP(e.date)) return; if (e.type === 'debt') credit += e.amount; else { paid += e.amount; if (e.method) meth[e.method] = (meth[e.method] || 0) + e.amount; }
      out.entries.push({ date: e.date, name: c.name, type: e.type, amount: e.amount, note: e.note, due: e.due, category: e.category, method: e.method }); });
    out.totals.customers++; out.totals.credit += credit; out.totals.paid += paid;
    if (sm.balance > 0) out.totals.outstanding += sm.balance;
    if (sm.overdue) { out.totals.overdueCount++; out.totals.overdueAmount += sm.balance; }
    out.customers.push({ name: c.name, phone: c.phone, credit, paid, balance: sm.balance, due: sm.dueDate, overdue: sm.overdue });
  }
  if (!onlyCust) all.forEach((e) => {   // cashbook: income and expenses not tied to a customer
    if (e.cust_id) return; const o = entryOut(e); if (!inP(o.date)) return;
    if (o.type === 'income') out.totals.income += o.amount; else if (o.type === 'expense') { out.totals.expense += o.amount; const k = o.category || 'Other'; cat[k] = (cat[k] || 0) + o.amount; } else return;
    if (o.method) meth[o.method] = (meth[o.method] || 0) + (o.type === 'income' ? o.amount : 0);
    out.entries.push({ date: o.date, name: o.category || '', type: o.type, amount: o.amount, note: o.note, due: '', category: o.category, method: o.method });
  });
  const T = out.totals; T.sales = T.credit + T.income; T.profit = T.sales - T.expense; T.cashIn = T.paid + T.income; T.net = T.cashIn - T.expense;
  Object.keys(T).forEach((k) => { if (k !== 'customers' && k !== 'overdueCount') T[k] = Math.round(T[k] * 100) / 100; });
  out.byCategory = Object.keys(cat).map((k) => ({ category: k, amount: Math.round(cat[k] * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  out.byMethod = Object.keys(meth).map((k) => ({ method: k, amount: Math.round(meth[k] * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  out.customers.sort((a, b) => b.balance - a.balance); out.entries.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}
const remindMarkup = (A, c, shop) => { const url = A.APP_URL ? A.APP_URL + '?d=' + c.token : ''; return url ? { inline_keyboard: [[{ text: shop.lang === 'so' ? 'Eeg xisaabta' : 'View statement', web_app: { url } }]] } : undefined; };

export default {
  id: 'debt', url: 'https://axm-06.pages.dev', button: 'Debt Book',
  defaults: { appName: 'Debt Book', freeAllowance: 10, plans: [
    { id: 'pro_m', label: 'Pro · 1 month', days: 30, credits: 0, usd: 2, stars: 150, region: 'ALL' }, { id: 'pro_y', label: 'Pro · 1 year', days: 365, credits: 0, usd: 18, stars: 1300, region: 'ALL' },
    { id: 'biz_m', label: 'Business · 1 month', days: 30, credits: 0, usd: 5, stars: 375, region: 'ALL' }, { id: 'biz_y', label: 'Business · 1 year', days: 365, credits: 0, usd: 45, stars: 3300, region: 'ALL' }] },
  schema: {
    Shops: ['owner_id', 'name', 'currency', 'freq', 'lang', 'updated_at', 'country'],
    Customers: ['cust_id', 'owner_id', 'name', 'phone', 'token', 'tg_chat', 'last_reminded', 'status', 'created_at'],
    Entries: ['entry_id', 'cust_id', 'owner_id', 'type', 'amount', 'date', 'due', 'note', 'created_at', 'category', 'method']
  },
  indexes: { Shops: [[['owner_id'], true]], Customers: [[['cust_id'], true], [['owner_id']], [['token']], [['tg_chat']]], Entries: [[['entry_id'], true], [['owner_id']], [['cust_id']]] },
  routes: {
    async dbBook(ctx, req, A) {   // shop, entries, customers and plan read side by side (one round trip)
      const E = ctx.E, [shop, ents, custRows, t] = await Promise.all([shopOf(E, ctx.uid), E.db.sel('Entries', { owner_id: ctx.uid }), E.db.sel('Customers', { owner_id: ctx.uid }), tier(ctx, A)]), by = {}; delete shop._r;
      ents.forEach((e) => { if (e.cust_id) (by[e.cust_id] = by[e.cust_id] || []).push(e); });
      const custs = custRows.filter((c) => c.status !== 'deleted').map((c) => sum(c, by[c.cust_id] || [], A.iso));
      return { ok: true, shop, tier: t, customers: custs, cash: ents.filter((e) => !e.cust_id).map(entryOut) };
    },
    async dbCustomer(ctx, req, A) {   // customer and its entries together; ownership checked before answering
      const [c, ents] = await Promise.all([ownCust(ctx, req.id), ctx.E.db.sel('Entries', { cust_id: String(req.id || '') })]);
      return c ? { ok: true, customer: sum(c, ents, A.iso) } : { ok: false, error: 'not_found' };
    },
    async dbSaveCustomer(ctx, req, A) {
      const E = ctx.E, name = String(req.name || '').trim().slice(0, 80), phone = String(req.phone || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 20);
      if (!name) return { ok: false, error: 'name' };
      if (req.id) { const c = await ownCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' }; await E.db.upd('Customers', c, { name, phone }); return { ok: true, customer: await custOut(E, c, A.iso) }; }
      // Same customer sent twice (double tap, retry) within 2 minutes: answer with the first one, use no free slot.
      const twin = (await E.db.sel('Customers', { owner_id: ctx.uid, name }, { where: '"created_at" >= ?', args: [new Date(Date.now() - 120000).toISOString()] })).find((c) => c.status !== 'deleted' && (c.phone || '') === phone);
      if (twin) return { ok: true, allowed: true, duplicate: true, access: await A.accessFor(ctx), customer: sum(twin, await E.db.sel('Entries', { cust_id: twin.cust_id }), A.iso) };
      const k = await A.consume(ctx, { tool: 'customer' }); if (!k.allowed) return { ok: true, allowed: false, access: k.access };
      const c = await E.db.ins('Customers', { cust_id: id('c'), owner_id: ctx.uid, name, phone, token: id('t'), status: 'active', created_at: new Date() });
      return { ok: true, allowed: true, access: k.access, customer: sum(c, [], A.iso) };
    },
    async dbDeleteCustomer(ctx, req) { const c = await ownCust(ctx, req.id); if (c) await ctx.E.db.upd('Customers', c, { status: 'deleted' }); return { ok: true }; },
    async dbAddEntry(ctx, req, A) {   // round 1: customer + its entries + duplicate check side by side; round 2: insert
      const E = ctx.E, type = TYPES.indexOf(req.type) >= 0 ? req.type : 'debt';
      const eid0 = /^e[a-z0-9]{6,24}$/.test(String(req.entry || '')) ? String(req.entry) : '';
      const [c, ents0, dup0] = await Promise.all([req.id ? ownCust(ctx, req.id) : null, req.id ? E.db.sel('Entries', { cust_id: String(req.id) }) : [], eid0 ? E.db.one('Entries', { entry_id: eid0 }) : null]);
      if ((type === 'debt' || type === 'payment' || req.id) && !c) return { ok: false, error: 'not_found' };
      const amt = Math.round(Number(req.amount) * 100) / 100; if (!(amt > 0) || amt > 1e12) return { ok: false, error: 'amount' };
      const eid = eid0 || id('e'), dup = dup0;   // phone-made id: a retried save is stored once
      if (dup) return String(dup.owner_id) === ctx.uid ? { ok: true, duplicate: true, entry: entryOut(dup), customer: c ? sum(c, ents0, A.iso) : null } : { ok: false, error: 'entry_id' };
      const dayv = /^\d{4}-\d{2}-\d{2}$/.test(String(req.date || '')) ? String(req.date) : day(new Date());
      const row = { entry_id: eid, cust_id: c ? c.cust_id : '', owner_id: ctx.uid, type, amount: amt, date: dayv, due: type === 'debt' ? String(req.due || '').slice(0, 10) : '',
        note: String(req.note || '').slice(0, 120), created_at: new Date(), category: String(req.category || '').replace(/[^\w &\-]/g, '').slice(0, 30), method: METHODS.indexOf(req.method) >= 0 ? req.method : '' };
      try { await E.db.ins('Entries', row); } catch (e) { const again = await E.db.one('Entries', { entry_id: eid }); if (!again) throw e; return { ok: true, duplicate: true, entry: entryOut(again), customer: c ? await custOut(E, c, A.iso) : null }; }   // same save arriving twice at once
      return { ok: true, entry: entryOut(row), customer: c ? sum(c, ents0.concat([row]), A.iso) : null };
    },
    async dbDeleteEntry(ctx, req, A) {
      const E = ctx.E, [c, e, ents] = await Promise.all([req.id ? ownCust(ctx, req.id) : null, E.db.one('Entries', { entry_id: String(req.entry || ''), owner_id: ctx.uid }), req.id ? E.db.sel('Entries', { cust_id: String(req.id) }) : []]);
      if (req.id && !c) return { ok: false, error: 'not_found' };
      const gone = e && (c ? e.cust_id === c.cust_id : !e.cust_id); if (gone) await E.db.del('Entries', e);
      return { ok: true, customer: c ? sum(c, gone ? ents.filter((x) => x.entry_id !== e.entry_id) : ents, A.iso) : null };
    },
    async dbRemindAction(ctx, req, A) {
      const E = ctx.E, c = await ownCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' };
      if ((await tier(ctx, A)) !== 'business') return { ok: true, allowed: false };
      if (req.via === 'bot') {
        if (!c.tg_chat || !ctx.token) return { ok: false, error: 'not_linked' };
        const shop = await shopOf(E, ctx.uid), sm = await custOut(E, c, A.iso);
        const r = await A.tgCall(ctx.token, 'sendMessage', { chat_id: c.tg_chat, text: reminder(sm, shop), reply_markup: remindMarkup(A, c, shop) });
        if (!r.ok) return { ok: false, error: 'telegram' };
      }
      await E.db.upd('Customers', c, { last_reminded: new Date() });
      return { ok: true, allowed: true, reminded: A.iso(new Date()) };
    },
    async dbSaveShop(ctx, req) {
      const E = ctx.E, s = req.shop || {}, cur = await shopOf(E, ctx.uid), data = { owner_id: ctx.uid, name: String(s.name || '').slice(0, 60), currency: String(s.currency || 'USD').slice(0, 6), country: /^[A-Z]{2}$/.test(String(s.country || '')) ? s.country : '',
        freq: ['off', 'weekly', 'due'].indexOf(s.freq) >= 0 ? s.freq : 'off', lang: s.lang === 'en' ? 'en' : 'so', updated_at: new Date() };
      if (cur._r) await E.db.upd('Shops', cur._r, data); else await E.db.ins('Shops', data);
      return { ok: true };
    },
    async dbStatement(ctx, req, A) {
      const E = ctx.E, c = await E.db.one('Customers', { token: String(req.token || '') }); if (!c || c.status === 'deleted') return { ok: false, error: 'not_found' };
      if (!c.tg_chat) await E.db.upd('Customers', c, { tg_chat: ctx.uid });   // opening the statement in Telegram links the customer for reminders
      const shop = await shopOf(E, c.owner_id), out = await custOut(E, c, A.iso); delete out.phone; delete out.token;
      return { ok: true, shop: { name: shop.name, currency: shop.currency }, customer: out };
    },
    async dbReport(ctx, req, A) {
      if ((await tier(ctx, A)) === 'free') return { ok: true, allowed: false };
      return { ok: true, allowed: true, report: await buildReport(ctx.E, ctx.uid, String(req.period || 'month'), req.customer || '', A.iso) };
    }
  },
  async botStart(req, A, E) {   // /start d_TOKEN: link the customer and open their statement
    const m = /^d_(\w+)$/.exec(String(req.arg || '')); if (!m) return { ok: true };
    const c = await E.db.one('Customers', { token: m[1] }); if (!c || c.status === 'deleted') return { ok: true };
    await E.db.upd('Customers', c, { tg_chat: String(req.user_id) });
    const shop = await shopOf(E, c.owner_id);
    return { ok: true, text: shop.lang === 'so' ? 'Waad ku xiran tahay ' + shop.name + '. Halkan ka eeg xisaabtaada.' : 'You are connected to ' + shop.name + '. View your account here.', query: 'd=' + m[1] };
  },
  daily: [async function reminders(A, E) {   // polite automatic reminders for linked customers (Business)
    const tok = await A.botToken(E); if (!tok) return;
    const st = await A.getSettings(E), shops = {}, tiers = {}, now = Date.now(), today = day(new Date());
    for (const c of await E.db.sel('Customers', {}, { where: '"tg_chat" IS NOT NULL AND "tg_chat" != \'\' AND "status" != ?', args: ['deleted'] })) {
      const shop = shops[c.owner_id] || (shops[c.owner_id] = await shopOf(E, c.owner_id)); if (shop.freq === 'off' || !shop.name) continue;
      const t = tiers[c.owner_id] || (tiers[c.owner_id] = tierOf(st, await A.activeSub(E, String(c.owner_id)))); if (t !== 'business') continue;
      const s = await custOut(E, c, A.iso); if (s.balance <= 0) continue;
      const last = c.last_reminded ? new Date(c.last_reminded).getTime() : 0, days = (now - last) / 864e5;
      if (!(shop.freq === 'weekly' ? days >= 7 : s.dueDate && s.dueDate <= today && days >= 3)) continue;
      await A.tgCall(tok, 'sendMessage', { chat_id: c.tg_chat, text: reminder(s, shop), reply_markup: remindMarkup(A, c, shop) });
      await E.db.upd('Customers', c, { last_reminded: new Date() });
    }
  }]
};
