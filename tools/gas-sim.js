/* Minimal Google Apps Script simulator for backend tests: node tools/gas-sim.js
   Loads apps/<app>/apps-script/*.gs into one global scope (like Apps Script) with mocked services. */
const vm = require('vm'), fs = require('fs'), crypto = require('crypto'), path = require('path');
const root = path.resolve(__dirname, '..');
function makeEnv(app) {
  const props = {}, sheets = {}, cache = {}, sent = [];
  const toBytes = (b) => Array.from(b).map((x) => (x > 127 ? x - 256 : x));
  const fromBytes = (a) => Buffer.from(a.map((x) => x & 255));
  function Sheet(name) { this.name = name; this.data = []; }
  Sheet.prototype = {
    getDataRange() { const d = this.data; return { getValues: () => d.map((r) => r.slice()) }; },
    appendRow(r) { this.data.push(r.map(clean)); },
    getRange(r, c, nr, nc) { const s = this; return { setValue(v) { while (s.data.length < r) s.data.push([]); s.data[r - 1][c - 1] = clean(v); },
      setValues(vs) { vs.forEach((row, i) => row.forEach((v, j) => { while (s.data.length < r + i) s.data.push([]); s.data[r - 1 + i][c - 1 + j] = v; })); return { setFontWeight() {} }; } }; },
    setFrozenRows() {}, deleteRow(r) { this.data.splice(r - 1, 1); }
  };
  function clean(v) { return typeof v === 'string' && v[0] === "'" ? v.slice(1) : v; }
  const book = { getId: () => 'SHEET1', getUrl: () => 'https://sheet', getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = new Sheet(n)), getSheets: () => Object.values(sheets), deleteSheet() {} };
  const fetches = [];
  const ctx = {
    console, JSON, Math, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
    SpreadsheetApp: { openById: () => book, create: () => book },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      newBlob: (d, mime, name) => ({ getBytes: () => (typeof d === 'string' ? toBytes(Buffer.from(d, 'utf8')) : d), mime, name, isBlob: true }),
      computeHmacSha256Signature: (v, k) => toBytes(crypto.createHmac('sha256', fromBytes(k)).update(fromBytes(v)).digest()),
      base64Decode: (s) => toBytes(Buffer.from(s, 'base64')), base64Encode: (a) => fromBytes(a).toString('base64'),
      getUuid: () => crypto.randomUUID(), sleep: () => {}, formatDate: (d, tz, f) => (f === 'HH:mm' ? d.toISOString().slice(11, 16) : d.toISOString().slice(0, 10))
    },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o }); const m = /bot[^/]+\/(\w+)/.exec(url); if (m) sent.push({ method: m[1], payload: o && o.payload });
      const body = m && m[1] === 'createInvoiceLink' ? { ok: true, result: 'https://t.me/$invoice' } : m && m[1] === 'createChatInviteLink' ? { ok: true, result: { invite_link: 'https://t.me/+abc' } } : { ok: true, result: {} };
      return { getContentText: () => JSON.stringify(ctx.__fetchReply ? ctx.__fetchReply(url, o) : body), getResponseCode: () => 200 }; } },
    ContentService: { createTextOutput: (s) => ({ setMimeType() { return { text: s }; } }), MimeType: { JSON: 'json' } },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }), everyHours: () => ({ create() {} }), everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
    DriveApp: { createFolder: () => ({ getId: () => 'F1', createFile: (b) => ({ getId: () => 'FILE' + Math.random() }) }), getFolderById: () => ({ createFile: () => ({ getId: () => 'FILE1' }) }), getFileById: () => ({ getBlob: () => ({ getBytes: () => [1, 2, 3] }) }) },
    Logger: { log() {} }
  };
  vm.createContext(ctx);
  const dir = path.join(root, 'apps', app, 'apps-script');
  fs.readdirSync(dir).sort((a, b) => (a === 'Core.gs' ? -1 : b === 'Core.gs' ? 1 : 0)).forEach((f) => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  const TOKEN = '123456:TEST_TOKEN';
  props['BOT_TOKEN_' + app] = TOKEN; props.ADMIN_IDS = '1001';
  vm.runInContext('install()', ctx);
  function initData(user) {
    const data = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE', user: JSON.stringify(user) };
    const dcs = Object.keys(data).sort().map((k) => k + '=' + data[k]).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
    return Object.keys(data).map((k) => k + '=' + encodeURIComponent(data[k])).join('&') + '&hash=' + hash;
  }
  function call(user, action, extra) {
    const body = Object.assign({ action, app, initData: user ? initData(user) : '' }, extra || {});
    ctx.__req = JSON.stringify(body);
    return JSON.parse(vm.runInContext('doPost({postData:{contents:__req}}).text', ctx));
  }
  function server(action, extra) { ctx.__req = JSON.stringify(Object.assign({ action, app, serverSecret: props.SERVER_SECRET }, extra || {})); return JSON.parse(vm.runInContext('doPost({postData:{contents:__req}}).text', ctx)); }
  function run(code) { return vm.runInContext(code, ctx); }
  function setSettings(patch) { const admin = { id: 1001, first_name: 'Ahmed' }; const st = call(admin, 'adminGet').settings; Object.assign(st, patch); return call(admin, 'adminSave', { settings: st }); }
  return { ctx, props, sheets, sent, fetches, call, server, run, setSettings, TOKEN };
}
module.exports = { makeEnv };
