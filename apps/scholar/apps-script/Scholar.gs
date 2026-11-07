/**
 * APP #5 — SCHOLARSHIP MATCHER ("Scholarship Finder")
 * Apps Script project = Core.gs + this file. Script properties: BOT_TOKEN_scholar, ADMIN_IDS.
 * Free users see the top N matches (settings.freeAllowance, default 3). Pro: all matches, saved list, deadline alerts.
 * Admin adds scholarships from the app (Settings → Manage scholarships) or directly in the "Scholarships" sheet.
 */
var THIS_APP = { id: 'scholar', url: 'https://axm-05.pages.dev', button: 'Scholarships' };
var EXTRA_SCHEMA = EXTRA_SCHEMA || {}, APP_HOOKS = APP_HOOKS || {}, APP_DEFAULTS = APP_DEFAULTS || {}, DAILY_JOBS = DAILY_JOBS || [];

APP_DEFAULTS.scholar = { appName: 'Scholarship Finder', freeAllowance: 3, plans: [
  { id: 'pro_m', label: 'Pro · 1 month', days: 30, credits: 0, usd: 1, stars: 75, region: 'ALL' },
  { id: 'pro_6m', label: 'Pro · 6 months', days: 180, credits: 0, usd: 5, stars: 350, region: 'ALL' } ] };

EXTRA_SCHEMA.Scholarships = ['sch_id','name','provider','host','levels','fields','eligible','funding','deadline','url','summary','lang_req','status','updated_at'];
EXTRA_SCHEMA.Profiles = ['user_id','country','level','field','english','need','gpa','alerts','updated_at'];
EXTRA_SCHEMA.Saved = ['user_id','sch_id','created_at','alerted'];

var SC_REGION = { SO:'AFRICA',KE:'AFRICA',ET:'AFRICA',DJ:'AFRICA',UG:'AFRICA',TZ:'AFRICA',RW:'AFRICA',SD:'AFRICA',EG:'AFRICA',NG:'AFRICA',GH:'AFRICA',SN:'AFRICA',CM:'AFRICA',ZA:'AFRICA',ZM:'AFRICA',ZW:'AFRICA',MW:'AFRICA',
  PK:'SOUTH_ASIA',IN:'SOUTH_ASIA',BD:'SOUTH_ASIA',NP:'SOUTH_ASIA',LK:'SOUTH_ASIA',AF:'SOUTH_ASIA',YE:'MENA' };
function scList(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); }
function scDay(v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd') : String(v || ''); }
function scItem(r) { return { id: r.sch_id, name: r.name, provider: r.provider, host: r.host, levels: scList(r.levels), fields: scList(r.fields), eligible: scList(r.eligible),
  funding: r.funding || 'full', deadline: scDay(r.deadline), url: r.url, summary: r.summary, lang_req: r.lang_req, status: r.status || 'active' }; }
function scDaysLeft(d) { return Math.ceil((new Date(d + 'T23:59:59Z') - new Date()) / 864e5); }
function scScore(p, s) {   // identical to the front-end score()
  if (!p || s.levels.indexOf(p.level) < 0) return 0;
  var el = s.eligible; if (!(el.indexOf('ALL') >= 0 || el.indexOf(p.country) >= 0 || el.indexOf(SC_REGION[p.country] || 'OTHER') >= 0)) return 0;
  if (scDaysLeft(s.deadline) < 0) return 0;
  var sc = 50 + (s.fields.indexOf(p.field) >= 0 ? 25 : (s.fields.indexOf('any') >= 0 || p.field === 'any') ? 15 : 0);
  sc += (p.need === 'any' || p.need === s.funding || s.funding === 'full') ? 15 : 5;
  sc += (!s.lang_req || p.english !== 'none') ? 10 : 0;
  return Math.min(100, sc);
}
function scProfile(uid) { var r = find('Profiles', function (x) { return String(x.user_id) === String(uid); });
  return r ? { country: r.country, level: r.level, field: r.field, english: r.english, need: r.need, gpa: r.gpa, alerts: r.alerts === true || r.alerts === 'TRUE', _r: r } : null; }
function scMatches(p) {
  return rows('Scholarships').map(scItem).filter(function (s) { return s.status !== 'hidden'; })
    .map(function (s) { s.score = scScore(p, s); return s; }).filter(function (s) { return s.score > 0; })
    .sort(function (a, b) { return b.score - a.score || a.deadline.localeCompare(b.deadline); });
}
function scPro(ctx) { var a = accessFor(ctx); return a.reason === 'sub' || a.reason === 'test'; }

APP_HOOKS.scholar = {
  routes: {
    scHome: function (ctx) {
      var p = scProfile(ctx.uid); if (!p) return { ok: true, profile: null, matches: [], locked: 0 };
      delete p._r; var all = scMatches(p), n = scPro(ctx) ? all.length : (Number(ctx.st.freeAllowance) || 3);
      var saved = rows('Saved').filter(function (s) { return String(s.user_id) === ctx.uid; }).map(function (s) { return s.sch_id; });
      return { ok: true, profile: p, matches: all.slice(0, n), locked: Math.max(0, all.length - n), saved: saved };
    },
    scSaveProfile: function (ctx, req) {
      var p = req.profile || {}, cur = scProfile(ctx.uid);
      var data = { user_id: ctx.uid, country: String(p.country || 'OT').slice(0, 3), level: ['bachelor','master','phd','short'].indexOf(p.level) >= 0 ? p.level : 'bachelor',
        field: String(p.field || 'any').slice(0, 20), english: String(p.english || 'none').slice(0, 10), need: ['full','partial','any'].indexOf(p.need) >= 0 ? p.need : 'any',
        gpa: String(p.gpa || '').slice(0, 12), alerts: !!p.alerts, updated_at: new Date() };
      if (cur) update('Profiles', cur._r, data); else append('Profiles', data);
      return { ok: true };
    },
    scSave: function (ctx, req) {
      if (req.on && !scPro(ctx)) return { ok: false, error: 'pro_required' };
      var r = find('Saved', function (x) { return String(x.user_id) === ctx.uid && x.sch_id === req.id; });
      if (req.on && !r) append('Saved', { user_id: ctx.uid, sch_id: String(req.id).slice(0, 30), created_at: new Date(), alerted: '' });
      if (!req.on && r) delRow('Saved', r);
      return { ok: true, saved: rows('Saved').filter(function (s) { return String(s.user_id) === ctx.uid; }).map(function (s) { return s.sch_id; }) };
    },
    adminSchList: function (ctx) { return { ok: true, items: rows('Scholarships').map(scItem) }; },
    adminSchSave: function (ctx, req) {
      var it = req.item || {}, data = { name: String(it.name || '').slice(0, 120), provider: String(it.provider || '').slice(0, 80), host: String(it.host || '').slice(0, 80),
        levels: (it.levels || []).join(','), fields: (it.fields || []).join(','), eligible: (it.eligible || ['ALL']).join(','), funding: it.funding === 'partial' ? 'partial' : 'full',
        deadline: String(it.deadline || '').slice(0, 10), url: String(it.url || '').slice(0, 300), summary: String(it.summary || '').slice(0, 600), lang_req: String(it.lang_req || '').slice(0, 80),
        status: it.status === 'hidden' ? 'hidden' : 'active', updated_at: new Date() };
      if (!data.name || !data.deadline || !/^https?:\/\//.test(data.url)) return { ok: false, error: 'Name, https URL and deadline are required.' };
      var r = it.id ? find('Scholarships', function (x) { return x.sch_id === it.id; }) : null;
      if (r) update('Scholarships', r, data); else { data.sch_id = 's' + Utilities.getUuid().slice(0, 8); append('Scholarships', data); }
      return { ok: true };
    },
    adminSchDelete: function (ctx, req) { var r = find('Scholarships', function (x) { return x.sch_id === req.id; }); if (r) delRow('Scholarships', r); return { ok: true }; }
  }
};

/* Daily: deadline alerts (Pro users with alerts on) for saved scholarships and new top matches, at 14, 7 and 2 days. */
DAILY_JOBS.push(function scAlerts() {
  var tok = botToken('scholar'); if (!tok) return;
  var items = {}; rows('Scholarships').forEach(function (r) { var s = scItem(r); items[s.id] = s; });
  var st = getSettings('scholar');
  rows('Profiles').forEach(function (pr) {
    if (!(pr.alerts === true || pr.alerts === 'TRUE')) return;
    var uid = String(pr.user_id), us = usageRow(uid, 'scholar');
    if (!(st.testMode || activeSub(uid, 'scholar'))) return;
    var p = scProfile(uid), ids = {};
    rows('Saved').forEach(function (s) { if (String(s.user_id) === uid) ids[s.sch_id] = 1; });
    scMatches(p).slice(0, 5).forEach(function (s) { ids[s.id] = 1; });
    Object.keys(ids).forEach(function (id) {
      var s = items[id]; if (!s || s.status === 'hidden') return;
      var d = scDaysLeft(s.deadline);
      if (d === 14 || d === 7 || d === 2) tgCall(tok, 'sendMessage', { chat_id: uid, text: s.name + ' — ' + d + ' days left to apply (deadline ' + s.deadline + ').',
        reply_markup: { inline_keyboard: [[{ text: 'Official website', url: s.url }]] } });
    });
  });
});
