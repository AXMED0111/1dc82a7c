/* Scholarship Finder on Cloudflare D1 — the D1 twin of apps/scholar/apps-script/Scholar.gs (same actions, same answers).
 * Free users see the top N matches (settings.freeAllowance, default 3). Pro: all matches, saved list, deadline alerts.
 * Scholarships are curated by the admin (a small table), so matching reads the whole list; everything per user is indexed. */
const SC_REGION = { SO: 'AFRICA', KE: 'AFRICA', ET: 'AFRICA', DJ: 'AFRICA', UG: 'AFRICA', TZ: 'AFRICA', RW: 'AFRICA', SD: 'AFRICA', EG: 'AFRICA', NG: 'AFRICA', GH: 'AFRICA', SN: 'AFRICA', CM: 'AFRICA', ZA: 'AFRICA', ZM: 'AFRICA', ZW: 'AFRICA', MW: 'AFRICA',
  PK: 'SOUTH_ASIA', IN: 'SOUTH_ASIA', BD: 'SOUTH_ASIA', NP: 'SOUTH_ASIA', LK: 'SOUTH_ASIA', AF: 'SOUTH_ASIA', YE: 'MENA' };
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(String);
const day = (v) => String(v || '').slice(0, 10);
const on = (v) => v === true || v === 1 || v === '1' || v === 'TRUE' || v === 'true';
function item(r) {
  return { id: r.sch_id, name: r.name, provider: r.provider, host: r.host, levels: list(r.levels), fields: list(r.fields), eligible: list(r.eligible),
    funding: r.funding || 'full', deadline: day(r.deadline), url: r.url, summary: r.summary, lang_req: r.lang_req, status: r.status || 'active' };
}
const daysLeft = (d) => Math.ceil((new Date(d + 'T23:59:59Z') - new Date()) / 864e5);
function score(p, s) {   // identical to the front-end score()
  if (!p || s.levels.indexOf(p.level) < 0) return 0;
  const el = s.eligible; if (!(el.indexOf('ALL') >= 0 || el.indexOf(p.country) >= 0 || el.indexOf(SC_REGION[p.country] || 'OTHER') >= 0)) return 0;
  if (daysLeft(s.deadline) < 0) return 0;
  let sc = 50 + (s.fields.indexOf(p.field) >= 0 ? 25 : (s.fields.indexOf('any') >= 0 || p.field === 'any') ? 15 : 0);
  sc += (p.need === 'any' || p.need === s.funding || s.funding === 'full') ? 15 : 5;
  sc += (!s.lang_req || p.english !== 'none') ? 10 : 0;
  return Math.min(100, sc);
}
const profileOut = (r) => (r ? { country: r.country, level: r.level, field: r.field, english: r.english, need: r.need, gpa: r.gpa === null || r.gpa === undefined ? '' : String(r.gpa), alerts: on(r.alerts) } : null);
const allItems = async (E) => (await E.db.sel('Scholarships', {})).map(item);
function matches(items, p) {
  return items.filter((s) => s.status !== 'hidden').map((s) => Object.assign({}, s, { score: score(p, s) })).filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.deadline.localeCompare(b.deadline));
}
const savedIds = async (E, uid) => (await E.db.sel('Saved', { user_id: uid })).map((s) => s.sch_id);

export default {
  id: 'scholar', url: 'https://axm-05.pages.dev', button: 'Scholarships',
  defaults: { appName: 'Scholarship Finder', freeAllowance: 3, plans: [
    { id: 'pro_m', label: 'Pro · 1 month', days: 30, credits: 0, usd: 1, stars: 75, region: 'ALL' },
    { id: 'pro_6m', label: 'Pro · 6 months', days: 180, credits: 0, usd: 5, stars: 350, region: 'ALL' }] },
  schema: {
    Scholarships: ['sch_id', 'name', 'provider', 'host', 'levels', 'fields', 'eligible', 'funding', 'deadline', 'url', 'summary', 'lang_req', 'status', 'updated_at'],
    Profiles: ['user_id', 'country', 'level', 'field', 'english', 'need', 'gpa', 'alerts', 'updated_at'],
    Saved: ['user_id', 'sch_id', 'created_at', 'alerted']
  },
  indexes: { Scholarships: [[['sch_id'], true]], Profiles: [[['user_id'], true], [['alerts']]], Saved: [[['user_id', 'sch_id']]] },
  routes: {
    async scHome(ctx, req, A) {
      const E = ctx.E, [pr, items, saved, pro] = await Promise.all([E.db.one('Profiles', { user_id: ctx.uid }), allItems(E), savedIds(E, ctx.uid), A.isPro(ctx)]);
      const p = profileOut(pr); if (!p) return { ok: true, profile: null, matches: [], locked: 0 };
      const all = matches(items, p), n = pro ? all.length : (Number(ctx.st.freeAllowance) || 3);
      return { ok: true, profile: p, matches: all.slice(0, n), locked: Math.max(0, all.length - n), saved };
    },
    async scSaveProfile(ctx, req) {
      const E = ctx.E, p = req.profile || {}, cur = await E.db.one('Profiles', { user_id: ctx.uid });
      const data = { country: String(p.country || 'OT').slice(0, 3), level: ['bachelor', 'master', 'phd', 'short'].indexOf(p.level) >= 0 ? p.level : 'bachelor',
        field: String(p.field || 'any').slice(0, 20), english: String(p.english || 'none').slice(0, 10), need: ['full', 'partial', 'any'].indexOf(p.need) >= 0 ? p.need : 'any',
        gpa: String(p.gpa || '').slice(0, 12), alerts: !!p.alerts, updated_at: new Date() };
      if (cur) await E.db.upd('Profiles', cur, data);
      else { try { await E.db.ins('Profiles', Object.assign({ user_id: ctx.uid }, data)); } catch (e) { await E.db.upd('Profiles', await E.db.one('Profiles', { user_id: ctx.uid }), data); } }   // twin taps
      return { ok: true };
    },
    async scSave(ctx, req, A) {
      const E = ctx.E, id = String(req.id || '').slice(0, 30);
      if (req.on && !(await A.isPro(ctx))) return { ok: false, error: 'pro_required' };
      const r = await E.db.one('Saved', { user_id: ctx.uid, sch_id: id });
      if (req.on && !r) await E.db.ins('Saved', { user_id: ctx.uid, sch_id: id, created_at: new Date(), alerted: '' });
      if (!req.on && r) await E.db.del('Saved', r);
      return { ok: true, saved: await savedIds(E, ctx.uid) };
    },
    async adminSchList(ctx) { return { ok: true, items: await allItems(ctx.E) }; },
    async adminSchSave(ctx, req) {
      const E = ctx.E, it = req.item || {}, data = { name: String(it.name || '').slice(0, 120), provider: String(it.provider || '').slice(0, 80), host: String(it.host || '').slice(0, 80),
        levels: (it.levels || []).join(','), fields: (it.fields || []).join(','), eligible: (it.eligible || ['ALL']).join(','), funding: it.funding === 'partial' ? 'partial' : 'full',
        deadline: String(it.deadline || '').slice(0, 10), url: String(it.url || '').slice(0, 300), summary: String(it.summary || '').slice(0, 600), lang_req: String(it.lang_req || '').slice(0, 80),
        status: it.status === 'hidden' ? 'hidden' : 'active', updated_at: new Date() };
      if (!data.name || !data.deadline || !/^https?:\/\//.test(data.url)) return { ok: false, error: 'Name, https URL and deadline are required.' };
      const r = it.id ? await E.db.one('Scholarships', { sch_id: String(it.id) }) : null;
      if (r) await E.db.upd('Scholarships', r, data); else await E.db.ins('Scholarships', Object.assign({ sch_id: 's' + crypto.randomUUID().slice(0, 8) }, data));
      return { ok: true };
    },
    async adminSchDelete(ctx, req) { const r = await ctx.E.db.one('Scholarships', { sch_id: String(req.id || '') }); if (r) await ctx.E.db.del('Scholarships', r); return { ok: true }; }
  },
  /* Daily: deadline alerts (Pro users with alerts on) for saved scholarships and new top matches, at 14, 7 and 2 days. */
  daily: [async function scAlerts(A, E) {
    const tok = await A.botToken(E); if (!tok) return;
    const items = await allItems(E), byId = {}; items.forEach((s) => { byId[s.id] = s; });
    if (!items.some((s) => s.status !== 'hidden' && [14, 7, 2].indexOf(daysLeft(s.deadline)) >= 0)) return;   // nothing is due today: no per-user work
    const st = await A.getSettings(E), profs = await E.db.sel('Profiles', {}, { where: '"alerts" IN (1, \'1\', \'TRUE\', \'true\')' });
    for (const pr of profs) {
      const uid = String(pr.user_id);
      if (!(st.testMode || (await A.activeSub(E, uid)))) continue;
      const ids = {}; (await savedIds(E, uid)).forEach((id) => { ids[id] = 1; });
      matches(items, profileOut(pr)).slice(0, 5).forEach((s) => { ids[s.id] = 1; });
      for (const id of Object.keys(ids)) {
        const s = byId[id]; if (!s || s.status === 'hidden') continue;
        const d = daysLeft(s.deadline);
        if (d === 14 || d === 7 || d === 2) await A.tgCall(tok, 'sendMessage', { chat_id: uid, text: s.name + ' — ' + d + ' days left to apply (deadline ' + s.deadline + ').',
          reply_markup: { inline_keyboard: [[{ text: 'Official website', url: s.url }]] } });
      }
    }
  }]
};
