/* Tests for the Cloudflare edge copy (shared/edge-proxy.js) and the webhook forwarder, against the Apps Script simulator
   and an in-memory D1 (node:sqlite).   node tools/test-edge.mjs */
import { createRequire } from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url), { makeEnv } = require('./gas-sim.js'), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-'));
fs.copyFileSync(path.join(root, 'shared/edge-proxy.js'), path.join(tmp, 'edge.mjs'));
fs.copyFileSync(path.join(root, 'shared/telegram-forwarder.js'), path.join(tmp, 'fwd.mjs'));
const edge = await import(path.join(tmp, 'edge.mjs')), fwd = await import(path.join(tmp, 'fwd.mjs'));
let pass = 0, fail = 0;
const ok = (n, c, info) => { if (c) pass++; else { fail++; console.log('  FAIL', n, info !== undefined ? JSON.stringify(info).slice(0, 300) : ''); } };

// D1 stand-in
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE cache (k TEXT PRIMARY KEY, app TEXT NOT NULL, uid TEXT NOT NULL, v TEXT NOT NULL, t INTEGER NOT NULL, ep INTEGER NOT NULL DEFAULT 0);
CREATE TABLE meta (app TEXT PRIMARY KEY, ep INTEGER NOT NULL DEFAULT 0, whsec TEXT);`);
const DB = { prepare: (q) => { const st = sql.prepare(q); let a = []; const o = { bind: (...x) => { a = x; return o; }, first: async () => st.get(...a) || null, run: async () => st.run(...a) }; return o; } };

const E = makeEnv('debt'), APP = 'debt', GAS_URL = 'https://gas.test/exec';
E.props['WEBHOOK_SECRET_' + APP] = 'whsec_abc123';
let gasCalls = 0, gasDelay = 0;
globalThis.fetch = async (url, o) => {
  gasCalls++; if (gasDelay) await new Promise((r) => setTimeout(r, gasDelay));
  E.ctx.__req = o.body; const txt = E.run('doPost({postData:{contents:__req}}).text');
  return { ok: true, text: async () => txt, json: async () => JSON.parse(txt) };
};
const env = { DB, GAS_URL, APP_ID: APP };
const pending = [];
async function post(body) {
  const ctx = { request: { text: async () => JSON.stringify(body) }, env, waitUntil: (p) => pending.push(p) };
  const r = await edge.onRequestPost(ctx); const txt = await r.text();
  return { how: r.headers.get('x-edge'), body: JSON.parse(txt) };
}
const settle = async () => { while (pending.length) await pending.shift(); };
async function hook(update, secret) {
  const req = { method: 'POST', json: async () => update, headers: { get: (h) => (h === 'x-telegram-bot-api-secret-token' ? secret : null) } };
  const r = await fwd.onRequest({ request: req, env, waitUntil: (p) => pending.push(p) }); await settle(); return r;
}
const U = { id: 2002, first_name: 'Hodan' }, V = { id: 3003, first_name: 'Abdi' };
const req = (u, action, extra) => Object.assign({ action, app: APP, initData: E.initData(u), rid: Math.random().toString(36).slice(2) }, extra || {});

console.log('• edge copy');
// Apps Script issues a pass; Cloudflare cannot trust it yet (secret not learned)
let r = await post(req(U, 'init')); await settle();
ok('first init passes through', r.how === 'pass-through' && r.body.ok, r);
const passU = r.body.edgePass; ok('edge pass issued', /^[\w-]+\.[0-9a-f]{64}$/.test(passU), passU);
ok('no copy before secret is known', sql.prepare('SELECT COUNT(*) n FROM cache').get().n === 0);
// a forged Telegram update must not teach Cloudflare a secret
await hook({ message: { chat: { id: 1 }, text: '/start' } }, 'wrong'); ok('forged secret not stored', !sql.prepare('SELECT whsec FROM meta').get());
await hook({ update_id: 1, message: { chat: { id: 2002 }, from: { id: 2002 }, text: '/start' } }, 'whsec_abc123');
ok('real secret learned', (sql.prepare('SELECT whsec FROM meta WHERE app = ?').get(APP) || {}).whsec === 'whsec_abc123');
// reads with a valid pass
gasCalls = 0; r = await post(req(U, 'dbBook', { pass: passU })); await settle();
ok('miss -> asks Google once', r.how === 'miss' && r.body.ok && gasCalls === 1, r);
gasCalls = 0; r = await post(req(U, 'dbBook', { pass: passU }));
ok('fresh hit -> Google not asked', r.how === 'hit' && gasCalls === 0 && r.body.ok, r);
// someone else's pass / tampered pass / pass with another user's initData
r = await post(req(V, 'dbBook', { pass: passU })); ok('pass of another user ignored', r.how === 'pass-through', r);
r = await post(req(U, 'dbBook', { pass: passU.slice(0, -2) + '00' })); ok('tampered pass ignored', r.how === 'pass-through', r);
const fake = Buffer.from(JSON.stringify({ u: '3003', a: APP, x: 9e9 })).toString('base64url') + '.' + passU.split('.')[1];
r = await post(req(V, 'dbBook', { pass: fake })); ok('forged payload ignored', r.how === 'pass-through', r);
// write clears this person's copies and marks others "check again"
const ep0 = sql.prepare('SELECT ep FROM meta').get().ep;
r = await post(req(U, 'dbSaveCustomer', { pass: passU, name: 'Ali', phone: '1' })); await settle();
ok('write passes through', r.how === 'pass-through', r);
ok('write cleared user copies', sql.prepare('SELECT COUNT(*) n FROM cache WHERE uid = ?').get('2002').n === 0);
ok('write bumped epoch', sql.prepare('SELECT ep FROM meta').get().ep === ep0 + 1);
gasCalls = 0; r = await post(req(U, 'dbBook', { pass: passU })); await settle(); ok('after write -> fresh from Google', r.how === 'miss' && gasCalls === 1, r);
// stale (older than 2 min): answered instantly, refreshed in background
sql.prepare('UPDATE cache SET t = ?').run(Date.now() - 5 * 60e3);
gasCalls = 0; r = await post(req(U, 'dbBook', { pass: passU })); ok('stale -> instant answer', r.how === 'stale', r);
await settle(); ok('stale -> refreshed in background', gasCalls === 1 && Date.now() - sql.prepare('SELECT t FROM cache').get().t < 5000);
// payment webhook marks copies "check again"
await hook({ update_id: 2, message: { chat: { id: 2002 }, from: { id: 2002 }, successful_payment: { invoice_payload: 'none', telegram_payment_charge_id: 'c', total_amount: 1 } } }, 'whsec_abc123');
gasCalls = 0; r = await post(req(U, 'dbBook', { pass: passU })); await settle(); ok('payment -> not served as fresh', r.how === 'stale' && gasCalls === 1, r);
// very old (> 30 min) and Google slow -> old copy after 8 s
sql.prepare('UPDATE cache SET t = ?').run(Date.now() - 40 * 60e3);
gasDelay = 50; r = await post(req(U, 'dbBook', { pass: passU })); ok('very old + Google quick -> waits for Google', r.how === 'refreshed', r); await settle();
sql.prepare('UPDATE cache SET t = ?').run(Date.now() - 40 * 60e3);
gasDelay = 9000; let t0 = Date.now(); r = await post(req(U, 'dbBook', { pass: passU }));
ok('very old + Google slow -> old copy within ~8 s', r.how === 'stale-timeout' && Date.now() - t0 < 8600 && r.body.ok, { how: r.how, ms: Date.now() - t0 });
await settle(); gasDelay = 0;
// admin and payment checks are always live
gasCalls = 0; await post(req(U, 'adminGet', { pass: passU })); await post(req(U, 'adminGet', { pass: passU })); ok('admin never cached', gasCalls === 2);
// errors are never saved
sql.exec('DELETE FROM cache'); r = await post(req(U, 'dbCustomer', { pass: passU, id: 'nope' })); await settle();
ok('error answers not saved', sql.prepare('SELECT COUNT(*) n FROM cache').get().n === 0 || r.body.ok, r);
// first init after secret known: copy kept under the new pass's user
sql.exec('DELETE FROM cache'); r = await post(req(V, 'init')); await settle();
ok('first visit init saved for that user', r.body.edgePass && sql.prepare('SELECT COUNT(*) n FROM cache WHERE uid = ?').get('3003').n === 1);
r = await post(req(V, 'init', { pass: r.body.edgePass })); ok('second open of init -> hit', r.how === 'hit', r);
// expired pass
const exp = (() => { const p = Buffer.from(JSON.stringify({ u: '2002', a: APP, x: 1 })).toString('base64url'); E.ctx.__p = p; return p + '.' + E.run("hmacHexGs(hmacHexGs('whsec_abc123','edge-pass-v1'), __p)"); })();
r = await post(req(U, 'dbBook', { pass: exp })); ok('expired pass ignored', r.how === 'pass-through', r);
// no D1 / no GAS_URL
env.GAS_URL = ''; r = await post(req(U, 'init')); ok('not configured -> clear error', r.body.error === 'not_configured'); env.GAS_URL = GAS_URL;

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
