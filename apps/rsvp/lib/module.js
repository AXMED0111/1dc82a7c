/* Invitations (RSVP) on Cloudflare D1. Queries are scoped by event_key / owner_id / guest_key (indexed).
 * Publishing an event uses the free allowance / credits / plan.
 * Every event has its own time zone (the host's phone, changeable): event times are venue times; check-in times are shown in it.
 * A guest's Yes / No is final (the host can reopen it); after replying, guests can only send messages to the hosts.
 * Tickets: a QR link (t_<guest key>) — the host or a door helper checks in; anyone else scanning only sees the ticket.
 * Check-in opens N hours before the start (default 3); an earlier scan only shows the ticket and when check-in opens — nobody can check in early. */
const FIELDS = ['title', 'hosts', 'date', 'time', 'venue', 'address', 'map_url', 'notes', 'dress', 'deadline', 'open_max'];
const DEF_TZ = 'Africa/Mogadishu', DEF_BEFORE = 3, ANYTIME = 999;
const key = (p) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 7).toLowerCase();
const day = (v) => String(v || '').slice(0, 10);

/* ---------- time zones (Intl, cached per zone) ---------- */
const fmts = new Map();
function fmt(tz, kind) {
  const k = tz + '|' + kind; let f = fmts.get(k); if (f) return f;
  const o = kind === 'parts' ? { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }
    : kind === 'day' ? { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' } : { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  f = new Intl.DateTimeFormat(kind === 'day' ? 'en-CA' : 'en-GB', o); if (fmts.size > 200) fmts.clear(); fmts.set(k, f); return f;
}
function tzOk(tz) { try { fmt(String(tz), 'clock'); return /^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){0,2}$|^UTC$/.test(String(tz)); } catch (e) { return false; } }
const tzOf = (e) => (e && tzOk(e.tz) ? e.tz : DEF_TZ);
function offsetMs(tz, d) {
  const p = {}; fmt(tz, 'parts').formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
}
function zoned(date, time, tz) {   // wall-clock date + time in tz -> instant
  const [y, m, d] = String(date || '').split('-').map(Number); if (!y || !m || !d) return null;
  const [hh, mm] = String(time || '00:00').split(':').map((x) => Number(x) || 0), wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - offsetMs(tz, new Date(wall)); t = wall - offsetMs(tz, new Date(t)); return new Date(t);
}
const clock = (d, tz) => fmt(tz, 'clock').format(d);
const dayIn = (d, tz) => fmt(tz, 'day').format(d);
const beforeOf = (e) => { const n = Number(e && e.checkin_before); return e && e.checkin_before !== null && e.checkin_before !== '' && isFinite(n) && n >= 0 ? n : DEF_BEFORE; };
function when(e) {   // start, check-in opening, replies closing — as instants
  const tz = tzOf(e), start = zoned(day(e.date), e.time, tz), b = beforeOf(e);
  return { tz, start, opens: start && b < ANYTIME ? new Date(start.getTime() - b * 36e5) : null, replyBy: e.deadline ? zoned(day(e.deadline), '23:59', tz) : null };
}
const repliesClosed = (e) => { const w = when(e); return !!(w.replyBy && Date.now() > w.replyBy.getTime() + 59e3); };

/* ---------- answers ---------- */
function pub(e) {
  const o = { key: e.event_key, status: e.status }; FIELDS.forEach((k) => { o[k] = e[k] === null || e[k] === undefined ? '' : e[k]; });
  const w = when(e); o.date = day(e.date); o.deadline = day(e.deadline); o.open_max = Number(e.open_max) || 1;
  o.tz = w.tz; o.checkin_before = beforeOf(e); o.starts_at = w.start ? w.start.toISOString() : ''; o.checkin_opens_at = w.opens ? w.opens.toISOString() : ''; o.replies_closed = repliesClosed(e);
  return o;
}
const guestOut = (g, iso) => ({ key: g.guest_key, name: g.name, max_party: Number(g.max_party) || 1, rsvp: g.rsvp || 'pending', party: Number(g.party) || 0, message: g.message || '',
  checked_in_at: g.checked_in_at ? iso(g.checked_in_at) : '', ticket_sent: !!g.ticket_file, replied_at: g.replied_at ? iso(g.replied_at) : '' });
function full(e, guests, iso) {
  const gs = guests.map((g) => guestOut(g, iso)), s = { yes: 0, yesPeople: 0, no: 0, maybe: 0, pending: 0, checked: 0 };
  gs.forEach((g) => { s[g.rsvp] = (s[g.rsvp] || 0) + 1; if (g.rsvp === 'yes') s.yesPeople += g.party; if (g.checked_in_at) s.checked += g.party || 1; });
  const o = pub(e); o.guests = gs; o.stats = s; o.staff = e.staff_code ? e.event_key + '-' + e.staff_code : ''; return o;
}
const event = (E, k) => E.db.one('Events', { event_key: String(k || '') });
async function own(ctx, k) { const e = await event(ctx.E, k); return e && String(e.owner_id) === ctx.uid && e.status !== 'deleted' ? e : null; }
const fullOf = async (E, e, iso) => full(e, await E.db.sel('Guests', { event_key: e.event_key }), iso);
const staffOk = (e, codes) => !!(e && e.staff_code && (Array.isArray(codes) ? codes : [codes]).some((c) => String(c || '') === e.event_key + '-' + e.staff_code));
async function door(ctx, k, staff) {   // the host, or a door helper holding this event's helper link
  const e = await event(ctx.E, k); if (!e || e.status === 'deleted') return null;
  return String(e.owner_id) === ctx.uid ? { e, role: 'host' } : staffOk(e, staff) ? { e, role: 'staff' } : null;
}
function ticketCode(c) {   // RSVP:<key>, a t.me link with start=t_<key>, ?t=<key>, or the bare code
  const s = String(c || '').trim(), m = /(?:[?&](?:start|startapp)=t_|[?&]t=|^RSVP:|^t_)([A-Za-z0-9]+)/i.exec(s);
  return (m ? m[1] : s).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}
async function counts(E, ek) {
  const r = await E.db.all('Guests', 'SELECT COALESCE(SUM(CASE WHEN "rsvp" = \'yes\' THEN "party" END), 0) AS expected, COALESCE(SUM(CASE WHEN "checked_in_at" IS NOT NULL AND "checked_in_at" != \'\' THEN "party" END), 0) AS arrived, COALESCE(SUM(CASE WHEN "checked_in_at" IS NOT NULL AND "checked_in_at" != \'\' THEN 1 END), 0) AS tickets FROM "Guests" WHERE "event_key" = ?', ek);
  return { expected: Number(r[0].expected) || 0, arrived: Number(r[0].arrived) || 0, tickets: Number(r[0].tickets) || 0 };
}
const people = (n) => (n === 1 ? '1 person' : n + ' people');
function ticketLines(e, g) {
  const w = when(e), b = beforeOf(e);
  return [e.title, g.name + ' · ' + people(Number(g.party) || 1), day(e.date) + (e.time ? ' · ' + e.time : ''), [e.venue, e.address].filter(Boolean).join(', '),
    w.opens && b < ANYTIME ? 'Check-in opens at ' + clock(w.opens, w.tz) + ' (' + dayIn(w.opens, w.tz) + ').' : ''].filter(Boolean);
}
const openTicket = (A, g) => ({ text: 'Open ticket', web_app: { url: A.APP_URL + '?g=' + g.guest_key } });
const ticketMarkup = (A, e, g) => ({ inline_keyboard: [[openTicket(A, g)]].concat(e.map_url && /^https?:\/\//.test(e.map_url) ? [[{ text: 'Directions', url: e.map_url }]] : []) });
async function findGuest(ctx, req) {   // personal link (g) or open link (e): one reply per Telegram user
  const E = ctx.E; let g = req.g ? await E.db.one('Guests', { guest_key: String(req.g) }) : null;
  const e = g ? await event(E, g.event_key) : await event(E, req.e);
  if (!e || e.status !== 'published') return { e: null, g: null };
  if (!g) g = await E.db.one('Guests', { event_key: e.event_key, tg_user: ctx.uid });
  return { e, g };
}

export default {
  id: 'rsvp', url: 'https://axm-04.pages.dev', button: 'Invitations',
  defaults: { appName: 'Invitations', freeAllowance: 1, plans: [
    { id: 'event1', label: 'One event', days: 0, credits: 1, usd: 5, stars: 350, region: 'ALL' },
    { id: 'event5', label: '5 events', days: 0, credits: 5, usd: 15, stars: 1000, region: 'ALL' },
    { id: 'pro_m', label: 'Unlimited · 1 month', days: 30, credits: 0, usd: 15, stars: 1000, region: 'ALL' }] },
  schema: {
    Events: ['event_key', 'owner_id', 'title', 'hosts', 'date', 'time', 'venue', 'address', 'map_url', 'notes', 'dress', 'deadline', 'open_max', 'status', 'created_at', 'tz', 'checkin_before', 'staff_code'],
    Guests: ['guest_key', 'event_key', 'name', 'phone', 'max_party', 'rsvp', 'party', 'message', 'tg_user', 'checked_in_at', 'created_at', 'replied_at', 'ticket_file', 'reminded']
  },
  indexes: { Events: [[['event_key'], true], [['owner_id']], [['status', 'date']]], Guests: [[['guest_key'], true], [['event_key']], [['event_key', 'tg_user']]] },

  /* the ticket picture made on the guest's phone goes to their own Telegram chat (kept by Telegram for the reminder) */
  async photo(ref, uid, A, E) {
    const g = await E.db.one('Guests', { guest_key: String(ref) }); if (!g || g.rsvp !== 'yes' || String(g.tg_user) !== String(uid)) return null;
    const e = await event(E, g.event_key); if (!e || e.status !== 'published') return null;
    return { caption: 'Your ticket\n' + ticketLines(e, g).join('\n') + '\nShow this at the entrance.', reply_markup: ticketMarkup(A, e, g),
      onSent: (fileId) => E.db.run('Guests', 'UPDATE "Guests" SET "ticket_file" = ? WHERE rowid = ?', fileId, g._id) };
  },
  /* links opened from Telegram: a ticket (t_), a door-helper link (s_), an invitation (e_ / g_) */
  async botStart(req, A, E) {
    const a = String(req.arg || ''), uid = String(req.user_id || '');
    if (/^t_/.test(a)) {
      const g = await E.db.one('Guests', { guest_key: ticketCode(a) }), e = g && await event(E, g.event_key); if (!g || !e || e.status !== 'published') return { text: 'This ticket is not valid.' };
      if (String(e.owner_id) === uid) return { text: 'Ticket: ' + g.name + ' · ' + people(Number(g.party) || 1) + ' — ' + e.title + '.\nTap below to check in.', query: 't=' + g.guest_key };
      return { text: 'Ticket\n' + ticketLines(e, g).join('\n') + '\nCheck-in is done by the hosts at the entrance.', query: 't=' + g.guest_key };
    }
    if (/^s_/.test(a)) { const e = await event(E, a.slice(2).split('-')[0]); return e ? { text: 'Door check-in for ' + e.title + '. Tap below to open the scanner.' } : null; }
    if (/^[eg]_/.test(a)) {
      const g = a.charAt(0) === 'g' ? await E.db.one('Guests', { guest_key: a.slice(2) }) : null, e = await event(E, g ? g.event_key : a.slice(2));
      return e && e.status === 'published' ? { text: 'You are invited: ' + e.title + (g ? ' (for ' + g.name + ')' : '') + '.\nTap below to open your invitation and reply.' } : null;
    }
    return null;
  },

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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false, error: 'date' };
      let e = ev.key ? await own(ctx, ev.key) : null;
      if (ev.key && !e) return { ok: false, error: 'forbidden' };
      data.tz = tzOk(ev.tz) ? String(ev.tz) : (e && tzOk(e.tz) ? e.tz : DEF_TZ);
      const b = Number(ev.checkin_before); data.checkin_before = ev.checkin_before !== undefined && ev.checkin_before !== '' && isFinite(b) ? (b >= ANYTIME ? ANYTIME : Math.max(0, Math.min(48, b))) : (e ? beforeOf(e) : DEF_BEFORE);
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
    async rsvGuestReset(ctx, req, A) {   // the host reopens a guest's reply (e.g. the guest asked to change it)
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      const g = await E.db.one('Guests', { guest_key: String(req.guest || ''), event_key: e.event_key }); if (!g) return { ok: false, error: 'not_found' };
      if (g.checked_in_at) return { ok: false, error: 'checked_in' };
      await E.db.upd('Guests', g, { rsvp: 'pending', party: 0, ticket_file: '', reminded: '', replied_at: '' });
      if (g.tg_user) E.defer(A.notify(E, g.tg_user, 'The hosts of ' + e.title + ' reopened your reply. Open your invitation to answer again.', { inline_keyboard: [[{ text: 'Open invitation', web_app: { url: A.APP_URL + '?g=' + g.guest_key } }]] }));
      return { ok: true, event: await fullOf(E, e, A.iso) };
    },
    async rsvCheckinUndo(ctx, req, A) {   // a mistake at the door: only the host
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      const g = await E.db.one('Guests', { guest_key: String(req.guest || ''), event_key: e.event_key }); if (!g) return { ok: false, error: 'not_found' };
      await E.db.upd('Guests', g, { checked_in_at: '' }); E.defer(A.log(E, ctx.uid, 'checkin_undo', e.event_key + ' ' + g.guest_key));
      return { ok: true, event: await fullOf(E, e, A.iso) };
    },
    async rsvStaffLink(ctx, req, A) {   // door helpers: scan tickets only (a new link stops the old one)
      const E = ctx.E, e = await own(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      if (!e.staff_code || req.renew) await E.db.upd('Events', e, { staff_code: crypto.randomUUID().replace(/-/g, '').slice(0, 10) });
      return { ok: true, event: await fullOf(E, e, A.iso) };
    },
    async rsvInvite(ctx, req, A) {
      const { e, g } = await findGuest(ctx, req); if (!e) return { ok: false, error: 'not_found' };
      return { ok: true, event: pub(e), guest: g ? guestOut(g, A.iso) : null };
    },
    async rsvReply(ctx, req, A) {
      const E = ctx.E; let { e, g } = await findGuest(ctx, req);
      if (!e) return { ok: false, error: 'not_found' };
      if (g && (g.rsvp === 'yes' || g.rsvp === 'no')) return { ok: false, error: 'locked', guest: guestOut(g, A.iso) };   // final: only messages from now on
      if (repliesClosed(e)) return { ok: false, error: 'closed' };
      const rsvp = ['yes', 'no', 'maybe'].indexOf(req.rsvp) >= 0 ? req.rsvp : 'yes';
      if (!g) {
        const name = String(req.name || '').trim().slice(0, 80); if (!name) return { ok: false, error: 'name' };
        g = await E.db.ins('Guests', { guest_key: key('g'), event_key: e.event_key, name, max_party: Number(e.open_max) || 1, rsvp: 'pending', party: 0, tg_user: ctx.uid, created_at: new Date() });
      }
      const party = rsvp === 'no' ? 0 : Math.max(1, Math.min(Number(g.max_party) || 1, Number(req.party) || 1));
      // only an open reply can be answered (two taps at once: the second finds it final)
      const c = await E.db.run('Guests', 'UPDATE "Guests" SET "rsvp" = ?, "party" = ?, "message" = ?, "tg_user" = ?, "replied_at" = ? WHERE rowid = ? AND COALESCE("rsvp", \'pending\') NOT IN (\'yes\', \'no\')',
        rsvp, party, String(req.message || '').slice(0, 300), ctx.uid, A.iso(new Date()), g._id);
      if (!c.meta || !c.meta.changes) { const now = await E.db.one('Guests', { guest_key: g.guest_key }); return { ok: false, error: 'locked', guest: guestOut(now, A.iso) }; }
      Object.assign(g, { rsvp, party, message: String(req.message || '').slice(0, 300), tg_user: ctx.uid, replied_at: new Date() });
      E.defer(A.notify(E, e.owner_id, 'RSVP for ' + e.title + ': ' + g.name + ' — ' + rsvp + (party ? ' (' + party + ')' : '') + (req.message ? ' — "' + String(req.message).slice(0, 100) + '"' : '')));
      return { ok: true, guest: guestOut(g, A.iso), event: pub(e) };
    },
    async rsvMessage(ctx, req, A) {   // after replying, a guest can still write to the hosts
      const E = ctx.E, { e, g } = await findGuest(ctx, req); if (!e || !g) return { ok: false, error: 'not_found' };
      if (g.rsvp === 'pending' || !g.rsvp) return { ok: false, error: 'reply_first' };
      const text = String(req.text || '').trim().slice(0, 300); if (!text) return { ok: false, error: 'empty' };
      const rl = A.rateLimit(E, ctx.uid, 'rsvmsg', 10, 86400); if (rl) return rl;
      await E.db.upd('Guests', g, { message: text });
      E.defer(A.notify(E, e.owner_id, 'Message from ' + g.name + ' (' + e.title + '): "' + text + '"'));
      return { ok: true, guest: guestOut(g, A.iso) };
    },
    async rsvTicket(ctx, req, A) {   // a scanned or shared ticket link: who is looking decides what they can do
      const E = ctx.E, g = await E.db.one('Guests', { guest_key: ticketCode(req.t) }), e = g && await event(E, g.event_key);
      if (!g || !e || e.status !== 'published') return { ok: false, error: 'not_found' };
      const role = String(e.owner_id) === ctx.uid ? 'host' : staffOk(e, req.staff) ? 'staff' : String(g.tg_user) === ctx.uid ? 'guest' : 'viewer';
      const out = guestOut(g, A.iso); if (role === 'viewer') delete out.key;
      return { ok: true, role, event: pub(e), guest: out, door: role === 'host' || role === 'staff' ? await counts(E, e.event_key) : null };
    },
    async rsvDoor(ctx, req, A) {   // the door screen: numbers + latest arrivals
      const d = await door(ctx, req.key, req.staff); if (!d) return { ok: false, error: 'forbidden' };
      const last = await ctx.E.db.sel('Guests', { event_key: d.e.event_key }, { where: '"checked_in_at" IS NOT NULL AND "checked_in_at" != \'\'', order: '"checked_in_at" DESC', limit: 8 });
      return { ok: true, role: d.role, event: pub(d.e), door: await counts(ctx.E, d.e.event_key), recent: last.map((g) => ({ name: g.name, party: Number(g.party) || 1, at: A.iso(g.checked_in_at) })) };
    },
    async rsvCheckin(ctx, req, A) {
      const E = ctx.E, d = await door(ctx, req.key, req.staff); if (!d) return { ok: false, error: 'forbidden' };
      const e = d.e, code = ticketCode(req.code), g = code && await E.db.one('Guests', { guest_key: code, event_key: e.event_key });
      if (!g) {   // a ticket of another event of the same host?
        const o = code && await E.db.one('Guests', { guest_key: code }), oe = o && await event(E, o.event_key);
        return oe && String(oe.owner_id) === String(e.owner_id) ? { ok: false, error: 'other_event', other: oe.title } : { ok: false, error: 'not_found' };
      }
      const base = { event: pub(e) };
      if (g.rsvp !== 'yes') return Object.assign(base, { ok: false, error: 'not_attending', guest: guestOut(g, A.iso) });
      if (g.checked_in_at) return Object.assign(base, { ok: true, result: 'already', guest: guestOut(g, A.iso), door: await counts(E, e.event_key) });
      const w = when(e);
      if (w.opens && Date.now() < w.opens.getTime()) return Object.assign(base, { ok: true, result: 'early', guest: guestOut(g, A.iso), opens_at: w.opens.toISOString(), starts_at: w.start ? w.start.toISOString() : '', door: await counts(E, e.event_key) });   // coming soon: nothing is recorded
      const at = A.iso(new Date()), c = await E.db.run('Guests', 'UPDATE "Guests" SET "checked_in_at" = ? WHERE rowid = ? AND ("checked_in_at" IS NULL OR "checked_in_at" = \'\')', at, g._id);
      const now = c.meta && c.meta.changes ? Object.assign(g, { checked_in_at: at }) : await E.db.one('Guests', { guest_key: g.guest_key });
      return Object.assign(base, { ok: true, result: c.meta && c.meta.changes ? 'in' : 'already', guest: guestOut(now, A.iso), door: await counts(E, e.event_key) });
    }
  },

  /* Hourly: reminder with the ticket in the 24 hours before the start (once per guest; Telegram calls capped per run). */
  hourly: [async function rsvReminders(A, E) {
    const tok = await A.botToken(E); if (!tok) return;
    const now = Date.now(), d0 = new Date(now - 864e5).toISOString().slice(0, 10), d2 = new Date(now + 2 * 864e5).toISOString().slice(0, 10);
    const evs = (await E.db.sel('Events', { status: 'published' }, { where: '"date" >= ? AND "date" <= ?', args: [d0, d2] })).filter((e) => { const w = when(e); return w.start && w.start.getTime() > now && w.start.getTime() - now <= 864e5; });
    let budget = 35;
    for (const e of evs) {
      if (budget <= 0) break;
      const w = when(e), today = dayIn(new Date(now), w.tz), word = dayIn(w.start, w.tz) === today ? 'today' : 'tomorrow';
      const gs = await E.db.sel('Guests', { event_key: e.event_key, rsvp: 'yes' }, { where: '"tg_user" IS NOT NULL AND "tg_user" != \'\' AND ("reminded" IS NULL OR "reminded" = \'\')', limit: budget });
      for (const g of gs) {
        budget--;
        const c = await E.db.run('Guests', 'UPDATE "Guests" SET "reminded" = ? WHERE rowid = ? AND ("reminded" IS NULL OR "reminded" = \'\')', A.iso(new Date()), g._id); if (!c.meta || !c.meta.changes) continue;
        const text = 'Reminder: ' + e.title + ' is ' + word + (e.time ? ' at ' + e.time : '') + (e.venue ? ' — ' + e.venue : '') + '.\n' + g.name + ' · ' + people(Number(g.party) || 1) + '\nShow your ticket at the entrance.';
        if (g.ticket_file) await A.tgCall(tok, 'sendPhoto', { chat_id: g.tg_user, photo: g.ticket_file, caption: text, reply_markup: ticketMarkup(A, e, g) });
        else await A.tgCall(tok, 'sendMessage', { chat_id: g.tg_user, text, reply_markup: ticketMarkup(A, e, g) });
      }
    }
  }]
};
