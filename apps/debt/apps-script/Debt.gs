/**
 * APP #6 — SHOP LEDGER + DEBT REMINDERS ("Debt Book")
 * Apps Script project = Core.gs + this file. Script properties: BOT_TOKEN_debt, ADMIN_IDS.
 * Ledger: credit sales and payments per customer, plus income and expenses (categories, payment method).
 * Tiers: Free = 10 customers, full recording. Pro = unlimited customers, reports and PDF statements.
 * Business = Pro + one-tap WhatsApp / SMS / Telegram reminders, "remind all" run and automatic bot reminders.
 * Customers who open their statement link (t.me/<bot>?start=d_TOKEN) get automatic polite reminders.
 */
var THIS_APP = { id: 'debt', url: 'https://axm-06.pages.dev', button: 'Debt Book' };
var EXTRA_SCHEMA = EXTRA_SCHEMA || {}, APP_HOOKS = APP_HOOKS || {}, APP_DEFAULTS = APP_DEFAULTS || {}, DAILY_JOBS = DAILY_JOBS || [];

APP_DEFAULTS.debt = { appName: 'Debt Book', freeAllowance: 10, plans: [
  { id: 'pro_m', label: 'Pro · 1 month', days: 30, credits: 0, usd: 2, stars: 150, region: 'ALL' },
  { id: 'pro_y', label: 'Pro · 1 year', days: 365, credits: 0, usd: 18, stars: 1300, region: 'ALL' },
  { id: 'biz_m', label: 'Business · 1 month', days: 30, credits: 0, usd: 5, stars: 375, region: 'ALL' },
  { id: 'biz_y', label: 'Business · 1 year', days: 365, credits: 0, usd: 45, stars: 3300, region: 'ALL' } ] };

EXTRA_SCHEMA.Shops = ['owner_id','name','currency','freq','lang','updated_at','country'];
EXTRA_SCHEMA.Customers = ['cust_id','owner_id','name','phone','token','tg_chat','last_reminded','status','created_at'];
EXTRA_SCHEMA.Entries = ['entry_id','cust_id','owner_id','type','amount','date','due','note','created_at','category','method'];
var DB_TYPES = ['debt', 'payment', 'income', 'expense'], DB_METHODS = ['cash', 'mobile', 'bank', 'card', 'other'];
/* free | pro | business. Test mode = business for everyone. */
function dbTierOf(st, sub) { if (st.testMode) return 'business'; if (!sub) return 'free'; return /^biz/.test(String(sub.plan)) ? 'business' : 'pro'; }
function dbTier(ctx) { var a = accessFor(ctx); return a.reason === 'test' ? 'business' : a.reason === 'sub' ? (/^biz/.test(String(a.plan)) ? 'business' : 'pro') : 'free'; }
function dbEntryOut(e) { return { id: e.entry_id, type: e.type, amount: Number(e.amount) || 0, date: dbDay(e.date), due: dbDay(e.due), note: e.note, category: e.category || '', method: e.method || '' }; }

function dbId(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function dbDay(v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd') : String(v || ''); }
function dbShop(uid) {
  var r = find('Shops', function (x) { return String(x.owner_id) === String(uid); });
  return r ? { name: r.name, currency: r.currency || 'USD', freq: r.freq || 'off', lang: r.lang || 'so', country: r.country || '', _r: r } : { name: '', currency: 'USD', freq: 'off', lang: 'so', country: '' };
}
function dbSum(c, entries) {
  var bal = 0, dues = [], list = entries.filter(function (e) { return e.cust_id === c.cust_id; }).map(function (e) {
    var amt = Number(e.amount) || 0; bal += e.type === 'debt' ? amt : -amt; if (e.type === 'debt' && e.due) dues.push(dbDay(e.due));
    return dbEntryOut(e);
  });
  dues.sort(); var due = bal > 0 ? (dues[0] || '') : '', today = dbDay(new Date());
  return { id: c.cust_id, name: c.name, phone: c.phone, token: c.token, linked: !!c.tg_chat, reminded: c.last_reminded ? iso(c.last_reminded) : '', entries: list, balance: Math.round(bal * 100) / 100, dueDate: due, overdue: !!due && due < today };
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
      return { ok: true, shop: shop, tier: dbTier(ctx), customers: rows('Customers').filter(function (c) { return String(c.owner_id) === ctx.uid && c.status !== 'deleted'; }).map(function (c) { return dbSum(c, ents); }),
        cash: ents.filter(function (e) { return String(e.owner_id) === ctx.uid && !e.cust_id; }).map(dbEntryOut) };
    },
    dbCustomer: function (ctx, req) { var c = dbOwnCust(ctx, req.id); return c ? { ok: true, customer: dbCustOut(c) } : { ok: false, error: 'not_found' }; },
    dbSaveCustomer: function (ctx, req) {
      var name = String(req.name || '').trim().slice(0, 80), phone = String(req.phone || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 20);   // international format: +<country code><number>
      if (!name) return { ok: false, error: 'name' };
      if (req.id) { var c = dbOwnCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' }; update('Customers', c, { name: name, phone: phone }); return { ok: true, customer: dbCustOut(c) }; }
      var k = consume(ctx, { tool: 'customer' });
      if (!k.allowed) return { ok: true, allowed: false, access: k.access };
      var id = dbId('c');
      append('Customers', { cust_id: id, owner_id: ctx.uid, name: name, phone: phone, token: dbId('t'), status: 'active', created_at: new Date() });
      return { ok: true, allowed: true, access: k.access, customer: dbCustOut(dbOwnCust(ctx, id)) };
    },
    dbDeleteCustomer: function (ctx, req) { var c = dbOwnCust(ctx, req.id); if (c) update('Customers', c, { status: 'deleted' }); return { ok: true }; },
    // Credit sales and payments belong to a customer; income and expenses may stand alone (cashbook).
    dbAddEntry: function (ctx, req) {
      var type = DB_TYPES.indexOf(req.type) >= 0 ? req.type : 'debt', c = req.id ? dbOwnCust(ctx, req.id) : null;
      if ((type === 'debt' || type === 'payment' || req.id) && !c) return { ok: false, error: 'not_found' };
      var amt = Math.round(Number(req.amount) * 100) / 100; if (!(amt > 0) || amt > 1e12) return { ok: false, error: 'amount' };
      // The phone makes the entry id, so a save that is sent twice (queue retry) is stored once.
      var eid = /^e[a-z0-9]{6,24}$/.test(String(req.entry || '')) ? String(req.entry) : dbId('e');
      var dup = find('Entries', function (x) { return x.entry_id === eid && String(x.owner_id) === ctx.uid; });
      if (dup) return { ok: true, duplicate: true, entry: dbEntryOut(dup), customer: c ? dbCustOut(c) : null };
      var day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.date || '')) ? String(req.date) : dbDay(new Date());
      append('Entries', { entry_id: eid, cust_id: c ? c.cust_id : '', owner_id: ctx.uid, type: type, amount: amt, date: day, due: type === 'debt' ? String(req.due || '').slice(0, 10) : '',
        note: String(req.note || '').slice(0, 120), created_at: new Date(), category: String(req.category || '').replace(/[^\w &\-]/g, '').slice(0, 30), method: DB_METHODS.indexOf(req.method) >= 0 ? req.method : '' });
      return { ok: true, entry: dbEntryOut(find('Entries', function (x) { return x.entry_id === eid; })), customer: c ? dbCustOut(c) : null };
    },
    dbDeleteEntry: function (ctx, req) {
      var c = req.id ? dbOwnCust(ctx, req.id) : null; if (req.id && !c) return { ok: false, error: 'not_found' };
      var e = find('Entries', function (x) { return x.entry_id === req.entry && String(x.owner_id) === ctx.uid && (c ? x.cust_id === c.cust_id : !x.cust_id); }); if (e) delRow('Entries', e);
      return { ok: true, customer: c ? dbCustOut(c) : null };
    },
    // Reminders (Business): via 'bot' = the bot messages a linked customer now; via 'mark' = the owner sent it on WhatsApp/SMS/Telegram.
    dbRemindAction: function (ctx, req) {
      var c = dbOwnCust(ctx, req.id); if (!c) return { ok: false, error: 'not_found' };
      if (dbTier(ctx) !== 'business') return { ok: true, allowed: false };
      if (req.via === 'bot') {
        if (!c.tg_chat || !ctx.token) return { ok: false, error: 'not_linked' };
        var shop = dbShop(ctx.uid), sm = dbCustOut(c), url = THIS_APP.url ? THIS_APP.url + '?d=' + c.token : '';
        var r = tgCall(ctx.token, 'sendMessage', { chat_id: c.tg_chat, text: dbReminder(sm, shop), reply_markup: url ? { inline_keyboard: [[{ text: shop.lang === 'so' ? 'Eeg xisaabta' : 'View statement', web_app: { url: url } }]] } : undefined });
        if (!r.ok) return { ok: false, error: 'telegram' };
      }
      update('Customers', c, { last_reminded: new Date() });
      return { ok: true, allowed: true, reminded: iso(new Date()) };
    },
    dbSaveShop: function (ctx, req) {
      var s = req.shop || {}, cur = dbShop(ctx.uid), data = { owner_id: ctx.uid, name: String(s.name || '').slice(0, 60), currency: String(s.currency || 'USD').slice(0, 6), country: /^[A-Z]{2}$/.test(String(s.country || '')) ? s.country : '',
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
      if (dbTier(ctx) === 'free') return { ok: true, allowed: false };
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
    totals: { credit: 0, paid: 0, outstanding: 0, overdueCount: 0, overdueAmount: 0, customers: 0, income: 0, expense: 0, sales: 0, profit: 0, cashIn: 0, net: 0 },
    customers: [], entries: [], byCategory: [], byMethod: [] }, cat = {}, meth = {}, inP = function (d) { return d >= P.from && d <= P.to; };
  rows('Customers').forEach(function (c) {
    if (String(c.owner_id) !== String(uid) || c.status === 'deleted' || (onlyCust && c.cust_id !== onlyCust)) return;
    var sm = dbSum(c, ents), credit = 0, paid = 0;
    sm.entries.forEach(function (e) { if (!inP(e.date)) return; if (e.type === 'debt') credit += e.amount; else { paid += e.amount; if (e.method) meth[e.method] = (meth[e.method] || 0) + e.amount; }
      out.entries.push({ date: e.date, name: c.name, type: e.type, amount: e.amount, note: e.note, due: e.due, category: e.category, method: e.method }); });
    out.totals.customers++; out.totals.credit += credit; out.totals.paid += paid;
    if (sm.balance > 0) out.totals.outstanding += sm.balance;
    if (sm.overdue) { out.totals.overdueCount++; out.totals.overdueAmount += sm.balance; }
    out.customers.push({ name: c.name, phone: c.phone, credit: credit, paid: paid, balance: sm.balance, due: sm.dueDate, overdue: sm.overdue });
  });
  if (!onlyCust) ents.forEach(function (e) {   // cashbook: income and expenses not tied to a customer
    if (String(e.owner_id) !== String(uid) || e.cust_id) return; var o = dbEntryOut(e); if (!inP(o.date)) return;
    if (o.type === 'income') out.totals.income += o.amount; else if (o.type === 'expense') { out.totals.expense += o.amount; var k = o.category || 'Other'; cat[k] = (cat[k] || 0) + o.amount; } else return;
    if (o.method) meth[o.method] = (meth[o.method] || 0) + (o.type === 'income' ? o.amount : 0);
    out.entries.push({ date: o.date, name: o.category || '', type: o.type, amount: o.amount, note: o.note, due: '', category: o.category, method: o.method });
  });
  var T = out.totals; T.sales = T.credit + T.income; T.profit = T.sales - T.expense; T.cashIn = T.paid + T.income; T.net = T.cashIn - T.expense;
  Object.keys(T).forEach(function (k) { if (k !== 'customers' && k !== 'overdueCount') T[k] = Math.round(T[k] * 100) / 100; });
  out.byCategory = Object.keys(cat).map(function (k) { return { category: k, amount: Math.round(cat[k] * 100) / 100 }; }).sort(function (a, b) { return b.amount - a.amount; });
  out.byMethod = Object.keys(meth).map(function (k) { return { method: k, amount: Math.round(meth[k] * 100) / 100 }; }).sort(function (a, b) { return b.amount - a.amount; });
  out.customers.sort(function (a, b) { return b.balance - a.balance; });
  out.entries.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}

/* Daily: polite automatic reminders for linked customers with a balance. */
DAILY_JOBS.push(function dbReminders() {
  var tok = botToken('debt'); if (!tok) return;
  var ents = rows('Entries'), shops = {}, tiers = {}, st = getSettings('debt'), now = Date.now(), today = dbDay(new Date());
  rows('Customers').forEach(function (c) {
    if (c.status === 'deleted' || !c.tg_chat) return;
    var shop = shops[c.owner_id] || (shops[c.owner_id] = dbShop(c.owner_id)); if (shop.freq === 'off' || !shop.name) return;
    var tier = tiers[c.owner_id] || (tiers[c.owner_id] = dbTierOf(st, activeSub(String(c.owner_id), 'debt'))); if (tier !== 'business') return;   // automatic reminders = Business
    var s = dbSum(c, ents); if (s.balance <= 0) return;
    var last = c.last_reminded ? new Date(c.last_reminded).getTime() : 0, days = (now - last) / 864e5;
    var due = shop.freq === 'weekly' ? days >= 7 : (s.dueDate && s.dueDate <= today && days >= 3);
    if (!due) return;
    var url = THIS_APP.url ? THIS_APP.url + '?d=' + c.token : '';
    tgCall(tok, 'sendMessage', { chat_id: c.tg_chat, text: dbReminder(s, shop), reply_markup: url ? { inline_keyboard: [[{ text: shop.lang === 'so' ? 'Eeg xisaabta' : 'View statement', web_app: { url: url } }]] } : undefined });
    update('Customers', c, { last_reminded: new Date() });
  });
});

/* ABOUT — generated by tools/build.py from shared/about.json (bot description shown before Start) */
var APP_ABOUT = {"short": "Shop ledger: credit, payments, income, expenses, profit and one-tap WhatsApp reminders.", "long": "Debt Book is the ledger for shops and small businesses.\n\n• Record credit sales, payments, income and expenses in seconds\n• See profit, cash in and who owes you, every day\n• Customers from any country with their WhatsApp number\n• Business plan: remind customers on WhatsApp, SMS or Telegram in one tap, or let the bot remind them\n• Reports and PDF statements (Pro)\n\nTap Start, then open the app."};
/* END ABOUT */
