/* Invitations (RSVP) on Cloudflare D1 — the D1 twin of apps/rsvp/apps-script/Rsvp.gs (same actions, same answers).
 * Queries are scoped by event_key / owner_id / guest_key (indexed). Publishing an event uses the free allowance / credits / plan. */
const FIELDS = ['title', 'hosts', 'date', 'time', 'venue', 'address', 'map_url', 'notes', 'dress', 'deadline', 'open_max'];
const key = (p) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 7).toLowerCase();
const day = (v) => String(v || '').slice(0, 10);
function pub(e) { const o = { key: e.event_key, status: e.status }; FIELDS.forEach((k) => { o[k] = e[k] === null || e[k] === undefined ? '' : e[k]; }); o.date = day(e.date); o.open_max = Number(e.open_max) || 1; return o; }
const guestOut = (g, iso) => ({ key: g.guest_key, name: g.name, max_party: Number(g.max_party) || 1, rsvp: g.rsvp || 'pending', party: Number(g.party) || 0, message: g.message || '', checked_in_at: g.checked_in_at ? iso(g.checked_in_at) : '' });
function full(e, guests, iso) {
  const gs = guests.map((g) => guestOut(g, iso)), s = { yes: 0, yesPeople: 0, no: 0, maybe: 0, pending: 0, checked: 0 };
  gs.forEach((g) => { s[g.rsvp] = (s[g.rsvp] || 0) + 1; if (g.rsvp === 'yes') s.yesPeople += g.party; if (g.checked_in_at) s.checked += g.party || 1; });
  const o = pub(e); o.guests = gs; o.stats = s; return o;
}
const event = (E, k) => E.db.one('Events', { event_key: String(k || '') });
async function own(ctx, k) { const e = await event(ctx.E, k); return e && String(e.owner_id) === ctx.uid && e.status !== 'deleted' ? e : null; }
const fullOf = async (E, e, iso) => full(e, await E.db.sel('Guests', { event_key: e.event_key }), iso);

export default {
  id: 'rsvp', url: 'https://axm-04.pages.dev', button: 'Invitations',
  defaults: { appName: 'Invitations', freeAllowance: 1, plans: [
    { id: 'event1', label: 'One event', days: 0, credits: 1, usd: 5, stars: 350, region: 'ALL' },
    { id: 'event5', label: '5 events', days: 0, credits: 5, usd: 15, stars: 1000, region: 'ALL' },
    { id: 'pro_m', label: 'Unlimited · 1 month', days: 30, credits: 0, usd: 15, stars: 1000, region: 'ALL' }] },
  schema: {
    Events: ['event_key', 'owner_id', 'title', 'hosts', 'date', 'time', 'venue', 'address', 'map_url', 'notes', 'dress', 'deadline', 'open_max', 'status', 'created_at'],
    Guests: ['guest_key', 'event_key', 'name', 'phone', 'max_party', 'rsvp', 'party', 'message', 'tg_user', 'checked_in_at', 'created_at']
  },
  indexes: { Events: [[['event_key'], true], [['owner_id']]], Guests: [[['guest_key'], true], [['event_key']], [['event_key', 'tg_user']]] },
  routes: {
    async rsvMine(ctx, req, A) {   // events + all their guests in two side-by-side rounds
      const E = ctx.E, evs = (await E.db.sel('Events', { owner_id: ctx.uid })).filter((e) => e.status !== 'deleted'), by = {};
      for (let i = 0; i < evs.length; i += 90) {
        const part = evs.slice(i, i + 90);
        (await E.db.sel('Guests', {}, { where: '"event_key" IN (' + part.map(() => '?').join(',') + ')', args: part.map((e) => e.event_key) })).forEach((g) => { (by[g.event_key] = by[g.event_key] || []).push(g); });
      }
      return { ok: true, events: evs.map((e) => full(e, by[e.event_key] || [], A.iso)).reverse() };
    },
    async rsvSave(ctx, req, A) {
      const E = ctx.E, ev = req.event || {}, data = {};
      FIELDS.forEach((k) => { data[k] = String(ev[k] == null ? '' : ev[k]).slice(0, k === 'notes' ? 600 : 200); });
      data.open_max = Math.max(1, Math.min(20, Number(ev.open_max) || 1));
      if (!data.title || !data.date) return { ok: false, error: 'required' };
      let e = ev.key ? await own(ctx, ev.key) : null;
      if (ev.key && !e) return { ok: false, error: 'forbidden' };
      if (e) await E.db.upd('Events', e, data);
      else e = await E.db.ins('Events', Object.assign(data, { event_key: key('e'), owner_id: ctx.uid, status: 'draft', created_at: new Date() }));
      return { ok: true, event: await fullOf(E, e, A.iso) };
    },
    async rsvPublish(ctx, req, A) {
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      if (e.status === 'published') return { ok: true, allowed: true, event: await fullOf(E, e, A.iso) };
      const c = await A.consume(ctx, { tool: 'publish' }); if (!c.allowed) return { ok: true, allowed: false, access: c.access };
      await E.db.upd('Events', e, { status: 'published' });
      return { ok: true, allowed: true, access: c.access, event: await fullOf(E, e, A.iso) };
    },
    async rsvEvent(ctx, req, A) { const e = await own(ctx, req.key); return e ? { ok: true, event: await fullOf(ctx.E, e, A.iso) } : { ok: false, error: 'forbidden' }; },
    async rsvGuestAdd(ctx, req, A) {
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      const stmts = [];
      (req.guests || []).slice(0, 500).forEach((g) => {
        const name = String(g.name || '').trim().slice(0, 80); if (!name) return;
        stmts.push(E.db.insStmt('Guests', { guest_key: key('g'), event_key: e.event_key, name, phone: String(g.phone || '').slice(0, 30), max_party: Math.max(1, Math.min(20, Number(g.max) || 1)), rsvp: 'pending', party: 0, created_at: new Date() }));
      });
      for (let i = 0; i < stmts.length; i += 50) await E.db.app.batch(stmts.slice(i, i + 50));   // many guests at once: one trip per 50
      return { ok: true, event: await fullOf(E, e, A.iso) };
    },
    async rsvGuestDel(ctx, req, A) {
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      const g = await E.db.one('Guests', { guest_key: String(req.guest || ''), event_key: e.event_key }); if (g) await E.db.del('Guests', g);
      return { ok: true, event: await fullOf(E, e, A.iso) };
    },
    async rsvInvite(ctx, req, A) {
      const E = ctx.E; let g = req.g ? await E.db.one('Guests', { guest_key: String(req.g) }) : null;
      const e = g ? await event(E, g.event_key) : await event(E, req.e);
      if (!e || e.status !== 'published') return { ok: false, error: 'not_found' };
      if (!g) g = await E.db.one('Guests', { event_key: e.event_key, tg_user: ctx.uid });   // open link: one reply per Telegram user
      return { ok: true, event: pub(e), guest: g ? guestOut(g, A.iso) : null };
    },
    async rsvReply(ctx, req, A) {
      const E = ctx.E; let g = req.g ? await E.db.one('Guests', { guest_key: String(req.g) }) : null;
      const e = g ? await event(E, g.event_key) : await event(E, req.e);
      if (!e || e.status !== 'published') return { ok: false, error: 'not_found' };
      if (!g) g = await E.db.one('Guests', { event_key: e.event_key, tg_user: ctx.uid });
      const rsvp = ['yes', 'no', 'maybe'].indexOf(req.rsvp) >= 0 ? req.rsvp : 'yes';
      if (!g) {
        const name = String(req.name || '').trim().slice(0, 80); if (!name) return { ok: false, error: 'name' };
        g = await E.db.ins('Guests', { guest_key: key('g'), event_key: e.event_key, name, max_party: Number(e.open_max) || 1, rsvp: 'pending', party: 0, tg_user: ctx.uid, created_at: new Date() });
      }
      const party = rsvp === 'no' ? 0 : Math.max(1, Math.min(Number(g.max_party) || 1, Number(req.party) || 1));
      await E.db.upd('Guests', g, { rsvp, party, message: String(req.message || '').slice(0, 300), tg_user: ctx.uid });
      E.defer(A.notify(E, e.owner_id, 'RSVP for ' + e.title + ': ' + g.name + ' — ' + rsvp + (party ? ' (' + party + ')' : '') + (req.message ? ' — "' + String(req.message).slice(0, 100) + '"' : '')));
      return { ok: true, guest: guestOut(g, A.iso) };
    },
    async rsvCheckin(ctx, req, A) {
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      const code = String(req.code || '').replace(/^RSVP:/i, '').trim().toLowerCase();
      const g = await E.db.one('Guests', { guest_key: code, event_key: e.event_key });
      if (!g) return { ok: false, error: 'not_found' };
      if (g.rsvp !== 'yes') return { ok: false, error: 'not_attending', guest: guestOut(g, A.iso) };
      if (g.checked_in_at) return { ok: true, result: 'already', guest: guestOut(g, A.iso) };
      await E.db.upd('Guests', g, { checked_in_at: new Date() });
      return { ok: true, result: 'in', guest: guestOut(g, A.iso) };
    }
  }
};
