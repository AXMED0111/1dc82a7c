// Edge copy in front of Google Apps Script (Cloudflare Pages Function, path /api/app).
// Same idea as the school system's Netlify copy: phones read a saved copy on Cloudflare (D1) instead of waiting for Google.
//  • Fresh copy (< 2 min, no change since): answered by Cloudflare, Google is not asked.
//  • Older copy (< 30 min): answered instantly, refreshed from Google in the background.
//  • Very old copy (> 30 min): wait for Google at most 8 s, otherwise answer with the old copy and refresh in the background.
//  • Writes (pay, save, send…) always go to Google; they clear that person's copies and mark everyone else's as "check again".
// Who is asking is proven by a signed pass issued by Apps Script (HMAC with a key derived from the bot's webhook secret,
// which this side learns only after Apps Script has accepted a real Telegram update). No bot token is stored here.
// Bindings: DB (D1). Variables (not secret): GAS_URL, APP_ID.
const FRESH = 120e3, OLD = 30 * 60e3, MAX_WAIT = 8000;
const WRITE = /^(consume|createOrder|submitManual|sendFile|sendReport|ticketCreate|ticketReply|clientError)$|(Save|Add|Del|Delete|Submit|Reply|Publish|Checkin|Decide|Withdraw|Score|Translate|Toggle|Action|Broadcast|TestJoin|RefreshLink|Close|Remove|Draft|Ask)/;
const NOCACHE = /^(admin|cc)|^(checkOrder|checkCode)$/;   // admin data and payment checks are always live
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
async function shortHash(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 24); }
function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); }
async function verifyPass(db, app, pass) {
  if (!pass || !db) return null;
  const [p, sig] = String(pass).split('.'); if (!p || !sig) return null;
  const m = await db.prepare('SELECT whsec FROM meta WHERE app = ?').bind(app).first(); if (!m || !m.whsec) return null;
  const key = await hmacHex(m.whsec, 'edge-pass-v1');
  if ((await hmacHex(key, p)) !== sig) return null;
  let o; try { o = JSON.parse(b64urlDecode(p)); } catch { return null; }
  if (o.a !== app || !o.u || o.x < Date.now() / 1000) return null;
  return String(o.u);
}
function initUser(initData) { try { return String(JSON.parse(new URLSearchParams(String(initData || '')).get('user') || '{}').id || ''); } catch { return ''; } }
const out = (txt, how) => new Response(txt, { headers: { 'content-type': 'application/json', 'x-edge': how, 'cache-control': 'no-store' } });

export async function onRequestPost(context) {
  const { request, env } = context, db = env.DB, app = env.APP_ID || '';
  if (!env.GAS_URL) return out('{"ok":false,"error":"not_configured"}', 'none');
  const raw = await request.text();
  let req; try { req = JSON.parse(raw); } catch { return out('{"ok":false,"error":"bad_request"}', 'none'); }
  const action = String(req.action || '');
  const gas = () => fetch(env.GAS_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: raw }).then((r) => r.text());
  let uid = null; try { uid = await verifyPass(db, app, req.pass); } catch { uid = null; }
  if (uid && initUser(req.initData) !== uid) uid = null;   // the pass must belong to the same Telegram user as the request
  const keyFor = async (u) => { const p = { ...req }; ['initData', 'rid', 'pass', 'v', 'start'].forEach((x) => delete p[x]); return app + '|' + u + '|' + action + '|' + (await shortHash(JSON.stringify(p))); };
  const save = async (u, k, txt, ep) => db.prepare('INSERT INTO cache (k, app, uid, v, t, ep) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, t = excluded.t, ep = excluded.ep').bind(k, app, u, txt, Date.now(), ep).run();
  const epoch = async () => { const m = db ? await db.prepare('SELECT ep FROM meta WHERE app = ?').bind(app).first() : null; return m ? m.ep : 0; };

  // Writes and anything without a trusted pass go straight to Google.
  if (!db || WRITE.test(action) || NOCACHE.test(action) || !uid) {
    const txt = await gas().catch(() => '{"ok":false,"error":"network"}');
    let o = null; try { o = JSON.parse(txt); } catch {}
    if (db && o && o.ok !== false) {
      if (WRITE.test(action)) context.waitUntil(Promise.all([
        uid ? db.prepare('DELETE FROM cache WHERE app = ? AND uid = ?').bind(app, uid).run() : null,
        db.prepare('INSERT INTO meta (app, ep) VALUES (?, 1) ON CONFLICT(app) DO UPDATE SET ep = ep + 1').bind(app).run()
      ]).catch(() => {}));
      else if (action === 'init' && !uid && o.edgePass) {   // first visit on a phone: keep a copy under the newly issued pass
        context.waitUntil((async () => { const u = await verifyPass(db, app, o.edgePass); if (u) { await save(u, await keyFor(u), txt, await epoch()); } })().catch(() => {}));
      }
    }
    return out(txt, 'pass-through');
  }

  // Reads by a known person: serve the edge copy.
  const k = await keyFor(uid), ep = await epoch(), row = await db.prepare('SELECT v, t, ep FROM cache WHERE k = ?').bind(k).first(), now = Date.now();
  const refresh = () => gas().then(async (txt) => { let o; try { o = JSON.parse(txt); } catch { return null; } if (o && o.ok) await save(uid, k, txt, ep); return txt; });
  if (row && row.ep === ep && now - row.t < FRESH) return out(row.v, 'hit');
  if (row) {
    if (now - row.t < OLD) { context.waitUntil(refresh().catch(() => {})); return out(row.v, 'stale'); }
    const p = refresh().catch(() => null);
    const first = await Promise.race([p, new Promise((r) => setTimeout(() => r(null), MAX_WAIT))]);
    if (first) return out(first, 'refreshed');
    context.waitUntil(p); return out(row.v, 'stale-timeout');
  }
  const txt = await refresh().catch(() => null);
  return out(txt || '{"ok":false,"error":"network"}', 'miss');
}
