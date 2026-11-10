/* Test bench for the D1 engine: in-memory D1 (node:sqlite), fake Telegram/TronGrid, signed Telegram logins.
   Usage: const S = await makeSim(module); await S.call(user, 'init'); */
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { createApp } from '../shared/worker/engine.js';

export function makeD1() {
  const db = new DatabaseSync(':memory:');
  const S = { trips: 0 };   // round trips to the database (what makes a request slow on a real network)
  const stmt = (sql, args = []) => ({
    _sql: sql,
    bind: (...a) => stmt(sql, a),
    async first(col) { S.trips++; const r = db.prepare(sql).get(...args); return r === undefined ? null : col ? r[col] : { ...r }; },
    async all() { S.trips++; return { results: db.prepare(sql).all(...args).map((r) => ({ ...r })), success: true, meta: {} }; },
    async run() { S.trips++; const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  });
  return {
    prepare: (sql) => stmt(sql),
    async batch(list) {   // like D1: one round trip, in one transaction; SELECTs return rows
      const out = [], t0 = S.trips; db.exec('BEGIN');
      try { for (const s of list) out.push(/^\s*(SELECT|PRAGMA|WITH)/i.test(s._sql) ? await s.all() : await s.run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      S.trips = t0 + 1; return out;
    },
    _db: db, _stats: S
  };
}

export const TOKEN = '123456:TEST_TOKEN', WHSEC = 'whsec_test', CONTROL_WHSEC = 'whsec_control';
export function initData(user, token = TOKEN) {
  const data = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE', user: JSON.stringify(user) };
  const dcs = Object.keys(data).sort().map((k) => k + '=' + data[k]).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest(), hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return Object.keys(data).map((k) => k + '=' + encodeURIComponent(data[k])).join('&') + '&hash=' + hash;
}

export async function makeSim(mod, opts = {}) {
  const central = opts.central || makeD1();
  central._db.exec('CREATE TABLE IF NOT EXISTS meta (app TEXT PRIMARY KEY, ep INTEGER NOT NULL DEFAULT 0, whsec TEXT)');
  central._db.prepare('INSERT OR REPLACE INTO meta (app, ep, whsec) VALUES (?, 0, ?)').run(mod.id, WHSEC);
  central._db.prepare('INSERT OR REPLACE INTO meta (app, ep, whsec) VALUES (?, 0, ?)').run('control', CONTROL_WHSEC);
  const env = { DB: makeD1(), CENTRAL: central, EDGE: central, MASTER_KEY: 'master-key-for-tests', CRON_KEY: 'cron-key' };
  const eng = createApp(mod), sent = [], fetches = [], pending = [];
  const S = { env, eng, sent, fetches, central, reply: null };
  globalThis.fetch = async (url, o = {}) => {
    url = String(url); fetches.push({ url, o });
    const m = /api\.telegram\.org\/bot([^/]+)\/(\w+)/.exec(url);
    let body;
    if (m) {
      let payload = o.body; if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) {} }
      sent.push({ token: m[1], method: m[2], payload, raw: typeof o.body === 'string' ? o.body : '[form]' });
      body = m[2] === 'createInvoiceLink' ? { ok: true, result: 'https://t.me/$invoice' } : m[2] === 'createChatInviteLink' ? { ok: true, result: { invite_link: 'https://t.me/+abc' } } : { ok: true, result: {} };
    }
    const rep = S.reply ? S.reply(url, o) : null; if (rep !== null && rep !== undefined) body = rep;
    if (body === undefined) body = { ok: true };
    const code = (body && body.__code) || 200;
    return { ok: code === 200, status: code, json: async () => body, text: async () => JSON.stringify(body),
      arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new TextEncoder().encode(JSON.stringify(body)).buffer) };
  };
  const ctx = (body, extra = {}) => Object.assign({ request: { text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => body, arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new ArrayBuffer(0)), headers: { get: (h) => (extra.headers || {})[h.toLowerCase()] || null }, method: extra.method || 'POST', url: extra.url || 'https://x.pages.dev/api/app' }, env, waitUntil: (p) => pending.push(p) });
  S.E = await eng._open(env);
  await eng._setSecret(S.E, 'BOT_TOKEN', TOKEN); await eng._setSecret(S.E, 'ADMIN_IDS', opts.admins || '1001'); await eng._setSecret(S.E, 'WEBHOOK_SECRET', WHSEC);
  S.settle = async () => { while (pending.length) await pending.shift(); };
  S.call = async (user, action, extra = {}) => { const b = Object.assign({ action, app: mod.id, initData: user ? initData(user) : '' }, extra); const r = await eng.app(ctx(b)); await S.settle(); return r.json(); };
  S.tg = async (update, secret = WHSEC) => { const r = await eng.telegram(ctx(update, { headers: { 'x-telegram-bot-api-secret-token': secret } })); await S.settle(); return r.status; };
  S.cron = async (job, key = 'cron-key') => { const r = await eng.cron(ctx('', { headers: { 'x-cron-key': key }, url: 'https://x/api/cron?job=' + job })); return r.status === 200 ? r.json() : { status: r.status }; };
  S.file = async (user, kind, bytes, params = {}) => { const qs = new URLSearchParams(Object.assign({ kind }, params)).toString(); const r = await eng.file(ctx(bytes, { headers: { 'x-tg-init': user ? initData(user) : '' }, url: 'https://x/api/file?' + qs })); return r.json(); };
  S.get = async (path) => { const r = await eng.file(ctx('', { method: 'GET', url: 'https://x.pages.dev' + path })); return { status: r.status, type: r.headers.get('content-type'), bytes: new Uint8Array(await r.arrayBuffer()) }; };
  S.sign = (body, key = WHSEC) => crypto.createHmac('sha256', key).update(body).digest('hex');
  S.migrate = async (obj, key = WHSEC) => { const body = JSON.stringify(obj); const r = await eng.migrate(ctx(body, { headers: { 'x-sig': S.sign(body, key) } })); return r.json(); };
  S.export = async (table, after = 0, key = CONTROL_WHSEC) => { const ts = String(Date.now()), sig = S.sign(table + '|' + after + '|' + ts, key); const r = await eng.exportRows(ctx('', { url: `https://x/api/export?table=${table}&after=${after}&ts=${ts}&sig=${sig}` })); return r.json(); };
  S.rows = (table, where = '') => env.DB._db.prepare(`SELECT * FROM "${table}" ${where}`).all();
  S.crows = (table, where = '') => central._db.prepare(`SELECT * FROM "${table}" ${where}`).all();
  S.setSettings = async (patch) => { const admin = { id: 1001, first_name: 'Ahmed' }; const st = (await S.call(admin, 'adminGet')).settings; Object.assign(st, patch); return S.call(admin, 'adminSave', { settings: st }); };
  return S;
}
