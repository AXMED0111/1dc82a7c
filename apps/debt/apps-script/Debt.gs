/**
 * APP #6 — DEBT REMINDERS FOR TRADERS ("Debt Book")
 * Apps Script project = Core.gs + this file. Script properties: BOT_TOKEN_debt, ADMIN_IDS.
 * Adding a customer uses the core free allowance (default 10 customers); Pro = unlimited.
 * Customers who open their statement link (t.me/<bot>?start=d_TOKEN) get automatic polite reminders.
 */
var THIS_APP = { id: 'debt', url: 'https://debt-70e13e91.netlify.app', button: 'Debt Book' };
var EXTRA_SCHEMA = EXTRA_SCHEMA || {}, APP_HOOKS = APP_HOOKS || {}, APP_DEFAULTS = APP_DEFAULTS || {}, DAILY_JOBS = DAILY_JOBS || [];

APP_DEFAULTS.debt = { appName: 'Debt Book', freeAllowance: 10, plans: [
  { id: 'pro_m', label: 'Pro · 1 month', days: 30, credits: 0, usd: 2, stars: 150, region: 'ALL' },
  { id: 'pro_y', label: 'Pro · 1 year', days: 365, credits: 0, usd: 18, stars: 1300, region: 'ALL' } ] };

EXTRA_SCHEMA.Shops = ['owner_id','name','currency','freq','lang','updated_at'];
EXTRA_SCHEMA.Customers = ['cust_id','owner_id','name','phone','token','tg_chat','last_reminded','status','created_at'];
EXTRA_SCHEMA.Entries = ['entry_id','cust_id','owner_id','type','amount','date','due','note','created_at'];

function dbId(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function dbDay(v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd') : String(v || ''); }
function dbShop(uid) {
  var r = find('Shops', function (x) { return String(x.owner_id) === String(uid); });
  return r ? { name: r.name, currency: r.currency || 'USD', freq: r.freq || 'off', lang: r.lang || 'so', _r: r } : { name: '', currency: 'USD', freq: 'off', lang: 'so' };
}
function dbSum(c, entries) {
  var bal = 0, dues = [], list = entries.filter(function (e) { return e.cust_id === c.cust_id; }).map(function (e) {
    var amt = Number(e.amount) || 0; bal += e.type === 'debt' ? amt : -amt; if (e.type === 'debt' && e.due) dues.push(dbDay(e.due));
    return { id: e.entry_id, type: e.type, amount: amt, date: dbDay(e.date), due: dbDay(e.due), note: e.note };
  });
  dues.sort(); var due = bal > 0 ? (dues[0] || '') : '', today = dbDay(new Date());
  return { id: c.cust_id, name: c.name, phone: c.phone, token: c.token, linked: !!c.tg_chat, entries: list, balance: Math.round(bal * 100) / 100, dueDate: due, overdue: !!due && due < today };
}
function dbOwnCust(ctx, id) { return find('Customers', function (c) { return c.cust_id === id && String(c.owner_id) === ctx.uid && c.status !== 'deleted'; }); }
function dbCustOut(c) { return dbSum(c, rows('Entries')); }
function dbMoney(n, cur) { return cur === 'USD' ? '$' + n.toFixed(2).replace(/\.00$/, '') : n + ' ' + cur; }
function dbReminder(c, shop) {
  var bal = dbMoney(c.balance, shop.currency);
  return shop.lang === 'so'
    ? 'Asc ' + c.name + ', tani waa xusuusin saaxiibtinimo oo ka timid ' + shop.name + '. Haraagaagu waa ' + bal + (c.dueDate ? ', waqtiga bixintu waa ' + c.dueDate : '') + '. Mahadsanid ganacsigaaga.'
    : 'Hello ' + c.name + ', this is a friendly reminder from ' + shop.name + '. Your balance is ' + bal + (c.dueDate ? ', due on ' + c.dueDate : '') + '. Thank you for your business.';
}

APP_HOOKS.debt = {
  routes: {
    dbBook: function (ctx) {
      var ents = rows('Entries'), shop = dbShop(ctx.uid); delete shop._r;
      return { ok: true, shop: shop, customers: rows('Customers').filter(function (c) { return String(c.owner_id) === ctx.uid && c.status !== 'deleted'; }).map(function (c) { return dbSum(c, ents); }) };
    },
    dbCustomer: function (ctx, req) { var c = dbOwnCust(ctx, req.id); return c ? { ok: true, customer: dbCustOut(c) } : { ok: false, error: 'not_found' }; },
    dbSaveCustomer: function (ctx, req) {
      var name = String(req.name || '').trim().slice(0, 80), phone = String(req.phone || '').trim().slice(0, 30);
      if (!name) return { ok: false, error: 'name' };
      if (req.id) { var c = dbOwnCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' }; update('Customers', c, { name: name, phone: phone }); return { ok: true, customer: dbCustOut(c) }; }
      var k = consume(ctx, { tool: 'customer' });
      if (!k.allowed) return { ok: true, allowed: false, access: k.access };
      var id = dbId('c');
      append('Customers', { cust_id: id, owner_id: ctx.uid, name: name, phone: phone, token: dbId('t'), status: 'active', created_at: new Date() });
      return { ok: true, allowed: true, access: k.access, customer: dbCustOut(dbOwnCust(ctx, id)) };
    },
    dbDeleteCustomer: function (ctx, req) { var c = dbOwnCust(ctx, req.id); if (c) update('Customers', c, { status: 'deleted' }); return { ok: true }; },
    dbAddEntry: function (ctx, req) {
      var c = dbOwnCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' };
      var amt = Math.round(Number(req.amount) * 100) / 100; if (!(amt > 0)) return { ok: false, error: 'amount' };
      append('Entries', { entry_id: dbId('e'), cust_id: c.cust_id, owner_id: ctx.uid, type: req.type === 'payment' ? 'payment' : 'debt', amount: amt,
        date: String(req.date || dbDay(new Date())).slice(0, 10), due: String(req.due || '').slice(0, 10), note: String(req.note || '').slice(0, 120), created_at: new Date() });
      return { ok: true, customer: dbCustOut(c) };
    },
    dbDeleteEntry: function (ctx, req) {
      var c = dbOwnCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' };
      var e = find('Entries', function (x) { return x.entry_id === req.entry && x.cust_id === c.cust_id; }); if (e) sh('Entries').deleteRow(e._row);
      return { ok: true, customer: dbCustOut(c) };
    },
    dbSaveShop: function (ctx, req) {
      var s = req.shop || {}, cur = dbShop(ctx.uid), data = { owner_id: ctx.uid, name: String(s.name || '').slice(0, 60), currency: String(s.currency || 'USD').slice(0, 6),
        freq: ['off', 'weekly', 'due'].indexOf(s.freq) >= 0 ? s.freq : 'off', lang: s.lang === 'en' ? 'en' : 'so', updated_at: new Date() };
      if (cur._r) update('Shops', cur._r, data); else append('Shops', data);
      return { ok: true };
    },
    dbStatement: function (ctx, req) {
      var c = find('Customers', function (x) { return x.token === req.token && x.status !== 'deleted'; }); if (!c) return { ok: false, error: 'not_found' };
      if (!c.tg_chat) update('Customers', c, { tg_chat: ctx.uid }); // opening the statement in Telegram links the customer for reminders
      var shop = dbShop(c.owner_id), out = dbCustOut(c); delete out.phone; delete out.token;
      return { ok: true, shop: { name: shop.name, currency: shop.currency }, customer: out };
    },
    dbReport: function (ctx, req) {
      if (!isPro(ctx)) return { ok: true, allowed: false };
      return { ok: true, allowed: true, report: dbBuildReport(ctx.uid, String(req.period || 'month'), req.customer || '') };
    }
  },
  // /start d_TOKEN from the bot chat: link the customer and open their statement
  botStart: function (req) {
    var m = /^d_(\w+)$/.exec(String(req.arg || '')); if (!m) return { ok: true };
    var c = find('Customers', function (x) { return x.token === m[1] && x.status !== 'deleted'; }); if (!c) return { ok: true };
    update('Customers', c, { tg_chat: String(req.user_id) });
    var shop = dbShop(c.owner_id);
    return { ok: true, text: shop.lang === 'so' ? 'Waad ku xiran tahay ' + shop.name + '. Halkan ka eeg xisaabtaada.' : 'You are connected to ' + shop.name + '. View your account here.', query: 'd=' + m[1] };
  }
};

function dbPeriod(p) {
  var n = new Date(), y = n.getUTCFullYear(), m = n.getUTCMonth(), f = function (d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); };
  if (p === 'lastmonth') return { from: f(new Date(Date.UTC(y, m - 1, 1))), to: f(new Date(Date.UTC(y, m, 0))) };
  if (p === 'year') return { from: y + '-01-01', to: f(n) };
  if (p === 'all') return { from: '0000-01-01', to: '9999-12-31' };
  return { from: f(new Date(Date.UTC(y, m, 1))), to: f(n) };
}
function dbBuildReport(uid, period, onlyCust) {
  var P = dbPeriod(period), shop = dbShop(uid), ents = rows('Entries'), out = { shop: { name: shop.name, currency: shop.currency }, period: period, from: P.from, to: P.to,
    totals: { credit: 0, paid: 0, outstanding: 0, overdueCount: 0, overdueAmount: 0, customers: 0 }, customers: [], entries: [] };
  rows('Customers').forEach(function (c) {
    if (String(c.owner_id) !== String(uid) || c.status === 'deleted' || (onlyCust && c.cust_id !== onlyCust)) return;
    var sm = dbSum(c, ents), credit = 0, paid = 0;
    sm.entries.forEach(function (e) { if (e.date < P.from || e.date > P.to) return; if (e.type === 'debt') credit += e.amount; else paid += e.amount;
      out.entries.push({ date: e.date, name: c.name, type: e.type, amount: e.amount, note: e.note, due: e.due }); });
    out.totals.customers++; out.totals.credit += credit; out.totals.paid += paid;
    if (sm.balance > 0) out.totals.outstanding += sm.balance;
    if (sm.overdue) { out.totals.overdueCount++; out.totals.overdueAmount += sm.balance; }
    out.customers.push({ name: c.name, phone: c.phone, credit: credit, paid: paid, balance: sm.balance, due: sm.dueDate, overdue: sm.overdue });
  });
  ['credit', 'paid', 'outstanding', 'overdueAmount'].forEach(function (k) { out.totals[k] = Math.round(out.totals[k] * 100) / 100; });
  out.customers.sort(function (a, b) { return b.balance - a.balance; });
  out.entries.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}

/* Daily: polite automatic reminders for linked customers with a balance. */
DAILY_JOBS.push(function dbReminders() {
  var tok = botToken('debt'); if (!tok) return;
  var ents = rows('Entries'), shops = {}, now = Date.now(), today = dbDay(new Date());
  rows('Customers').forEach(function (c) {
    if (c.status === 'deleted' || !c.tg_chat) return;
    var shop = shops[c.owner_id] || (shops[c.owner_id] = dbShop(c.owner_id)); if (shop.freq === 'off' || !shop.name) return;
    var s = dbSum(c, ents); if (s.balance <= 0) return;
    var last = c.last_reminded ? new Date(c.last_reminded).getTime() : 0, days = (now - last) / 864e5;
    var due = shop.freq === 'weekly' ? days >= 7 : (s.dueDate && s.dueDate <= today && days >= 3);
    if (!due) return;
    var url = THIS_APP.url ? THIS_APP.url + '?d=' + c.token : '';
    tgCall(tok, 'sendMessage', { chat_id: c.tg_chat, text: dbReminder(s, shop), reply_markup: url ? { inline_keyboard: [[{ text: shop.lang === 'so' ? 'Eeg xisaabta' : 'View statement', web_app: { url: url } }]] } : undefined });
    update('Customers', c, { last_reminded: new Date() });
  });
});
