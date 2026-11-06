/**
 * APP #4 — EVENT / WEDDING RSVP ("Invitations")
 * Apps Script project = Core.gs + this file. Script properties: BOT_TOKEN_rsvp, ADMIN_IDS.
 * Publishing an event uses the core free allowance / credits / subscription (consume).
 */
var THIS_APP = { id: 'rsvp', url: 'https://rsvp-f8e2b81e.netlify.app', button: 'Invitations' };   // url = your Netlify site, then run connectTelegram()
var EXTRA_SCHEMA = EXTRA_SCHEMA || {}, APP_HOOKS = APP_HOOKS || {}, APP_DEFAULTS = APP_DEFAULTS || {};

APP_DEFAULTS.rsvp = { appName: 'Invitations', freeAllowance: 1, plans: [
  { id: 'event1', label: 'One event', days: 0, credits: 1, usd: 5, stars: 350, region: 'ALL' },
  { id: 'event5', label: '5 events', days: 0, credits: 5, usd: 15, stars: 1000, region: 'ALL' },
  { id: 'pro_m', label: 'Unlimited · 1 month', days: 30, credits: 0, usd: 15, stars: 1000, region: 'ALL' } ] };

EXTRA_SCHEMA.Events = ['event_key','owner_id','title','hosts','date','time','venue','address','map_url','notes','dress','deadline','open_max','status','created_at'];
EXTRA_SCHEMA.Guests = ['guest_key','event_key','name','phone','max_party','rsvp','party','message','tg_user','checked_in_at','created_at'];

var RSV_FIELDS = ['title','hosts','date','time','venue','address','map_url','notes','dress','deadline','open_max'];
function rsvKey(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 7).toLowerCase(); }
function rsvEvent(key) { return find('Events', function (e) { return e.event_key === key; }); }
function rsvVal(v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', v.getHours() || v.getMinutes() ? 'HH:mm' : 'yyyy-MM-dd') : v; }
function rsvPub(e) { var o = { key: e.event_key, status: e.status }; RSV_FIELDS.forEach(function (k) { o[k] = rsvVal(e[k]); }); o.date = e.date instanceof Date ? Utilities.formatDate(e.date, 'UTC', 'yyyy-MM-dd') : e.date; return o; }
function rsvGuest(g) { return { key: g.guest_key, name: g.name, max_party: Number(g.max_party) || 1, rsvp: g.rsvp || 'pending', party: Number(g.party) || 0, message: g.message, checked_in_at: g.checked_in_at ? iso(g.checked_in_at) : '' }; }
function rsvFull(e) {
  var gs = rows('Guests').filter(function (g) { return g.event_key === e.event_key; }).map(rsvGuest), s = { yes: 0, yesPeople: 0, no: 0, maybe: 0, pending: 0, checked: 0 };
  gs.forEach(function (g) { s[g.rsvp] = (s[g.rsvp] || 0) + 1; if (g.rsvp === 'yes') s.yesPeople += g.party; if (g.checked_in_at) s.checked += g.party || 1; });
  var o = rsvPub(e); o.guests = gs; o.stats = s; return o;
}
function rsvOwn(ctx, key) { var e = rsvEvent(key); return e && String(e.owner_id) === ctx.uid ? e : null; }

APP_HOOKS.rsvp = {
  routes: {
    rsvMine: function (ctx) { return { ok: true, events: rows('Events').filter(function (e) { return String(e.owner_id) === ctx.uid && e.status !== 'deleted'; }).map(rsvFull).reverse() }; },
    rsvSave: function (ctx, req) {
      var ev = req.event || {}, data = {};
      RSV_FIELDS.forEach(function (k) { data[k] = String(ev[k] == null ? '' : ev[k]).slice(0, k === 'notes' ? 600 : 200); });
      data.open_max = Math.max(1, Math.min(20, Number(ev.open_max) || 1));
      if (!data.title || !data.date) return { ok: false, error: 'required' };
      var e = ev.key ? rsvOwn(ctx, ev.key) : null;
      if (ev.key && !e) return { ok: false, error: 'forbidden' };
      if (e) update('Events', e, data);
      else { data.event_key = rsvKey('e'); data.owner_id = ctx.uid; data.status = 'draft'; data.created_at = new Date(); append('Events', data); }
      return { ok: true, event: rsvFull(rsvEvent(e ? e.event_key : data.event_key)) };
    },
    rsvPublish: function (ctx, req) {
      var e = rsvOwn(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      if (e.status === 'published') return { ok: true, allowed: true, event: rsvFull(e) };
      var c = consume(ctx, { tool: 'publish' });
      if (!c.allowed) return { ok: true, allowed: false, access: c.access };
      update('Events', e, { status: 'published' });
      return { ok: true, allowed: true, access: c.access, event: rsvFull(rsvEvent(req.key)) };
    },
    rsvEvent: function (ctx, req) { var e = rsvOwn(ctx, req.key); return e ? { ok: true, event: rsvFull(e) } : { ok: false, error: 'forbidden' }; },
    rsvGuestAdd: function (ctx, req) {
      var e = rsvOwn(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      (req.guests || []).slice(0, 500).forEach(function (g) {
        var name = String(g.name || '').trim().slice(0, 80); if (!name) return;
        append('Guests', { guest_key: rsvKey('g'), event_key: e.event_key, name: name, phone: String(g.phone || '').slice(0, 30), max_party: Math.max(1, Math.min(20, Number(g.max) || 1)), rsvp: 'pending', party: 0, created_at: new Date() });
      });
      return { ok: true, event: rsvFull(e) };
    },
    rsvGuestDel: function (ctx, req) {
      var e = rsvOwn(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      var g = find('Guests', function (x) { return x.guest_key === req.guest && x.event_key === e.event_key; });
      if (g) sh('Guests').deleteRow(g._row);
      return { ok: true, event: rsvFull(e) };
    },
    rsvInvite: function (ctx, req) {
      var g = req.g ? find('Guests', function (x) { return x.guest_key === req.g; }) : null, e = g ? rsvEvent(g.event_key) : rsvEvent(req.e);
      if (!e || e.status !== 'published') return { ok: false, error: 'not_found' };
      if (!g) g = find('Guests', function (x) { return x.event_key === e.event_key && String(x.tg_user) === ctx.uid; }); // open link: one reply per Telegram user
      return { ok: true, event: rsvPub(e), guest: g ? rsvGuest(g) : null };
    },
    rsvReply: function (ctx, req) {
      var g = req.g ? find('Guests', function (x) { return x.guest_key === req.g; }) : null, e = g ? rsvEvent(g.event_key) : rsvEvent(req.e);
      if (!e || e.status !== 'published') return { ok: false, error: 'not_found' };
      if (!g) g = find('Guests', function (x) { return x.event_key === e.event_key && String(x.tg_user) === ctx.uid; });
      var rsvp = ['yes', 'no', 'maybe'].indexOf(req.rsvp) >= 0 ? req.rsvp : 'yes';
      if (!g) {
        var name = String(req.name || '').trim().slice(0, 80); if (!name) return { ok: false, error: 'name' };
        append('Guests', { guest_key: rsvKey('g'), event_key: e.event_key, name: name, max_party: Number(e.open_max) || 1, rsvp: 'pending', party: 0, tg_user: ctx.uid, created_at: new Date() });
        g = find('Guests', function (x) { return x.event_key === e.event_key && String(x.tg_user) === ctx.uid; });
      }
      var party = rsvp === 'no' ? 0 : Math.max(1, Math.min(Number(g.max_party) || 1, Number(req.party) || 1));
      update('Guests', g, { rsvp: rsvp, party: party, message: String(req.message || '').slice(0, 300), tg_user: ctx.uid });
      notify('rsvp', e.owner_id, 'RSVP for ' + e.title + ': ' + g.name + ' — ' + rsvp + (party ? ' (' + party + ')' : '') + (req.message ? ' — "' + String(req.message).slice(0, 100) + '"' : ''));
      return { ok: true, guest: rsvGuest(find('Guests', function (x) { return x.guest_key === g.guest_key; })) };
    },
    rsvCheckin: function (ctx, req) {
      var e = rsvOwn(ctx, req.key); if (!e) return { ok: false, error: 'forbidden' };
      var code = String(req.code || '').replace(/^RSVP:/i, '').trim().toLowerCase();
      var g = find('Guests', function (x) { return x.guest_key === code && x.event_key === e.event_key; });
      if (!g) return { ok: false, error: 'not_found' };
      if (g.rsvp !== 'yes') return { ok: false, error: 'not_attending', guest: rsvGuest(g) };
      if (g.checked_in_at) return { ok: true, result: 'already', guest: rsvGuest(g) };
      update('Guests', g, { checked_in_at: new Date() });
      return { ok: true, result: 'in', guest: rsvGuest(find('Guests', function (x) { return x.guest_key === code; })) };
    }
  }
};
