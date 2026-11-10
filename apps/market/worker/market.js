/* Field Tasks on Cloudflare D1 — the D1 twin of apps/market/apps-script/Market.gs (same actions, same answers).
 * Businesses fund a task up front (rewards × submissions + platform fee) with the core payment methods.
 * Workers submit photo / GPS / answers; approved work is credited to the worker's balance; the admin pays withdrawals.
 * Money and slot changes are single database transactions (no double pay, no overbooking, no double withdrawal).
 * Photos: kept in D1 for a moment, then sent to the business owner's Telegram chat (they see it at once) and served
 * from Telegram by a signed link; if Telegram cannot deliver, the photo simply stays in D1. */
const mkId = (p) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const yes = (v) => v === true || v === 1 || v === '1' || v === 'TRUE' || v === 'true';
const day = (v) => String(v || '').slice(0, 10);
const json = (s) => { try { return JSON.parse(s || '[]'); } catch (e) { return []; } };
const num = (v) => v !== null && v !== undefined && v !== '' && isFinite(v);
const PHOTO_MAX = 1800000;   // base64 characters (~1.3 MB picture; D1 rows hold up to 2 MB). The app sends ~1280 px JPEGs (~0.3 MB).
function taskOut(r) {
  return { id: r.task_id, title: r.title, instructions: r.instructions, city: r.city, reward: Number(r.reward) || 0, slots: Number(r.slots) || 0, filled: Number(r.filled) || 0,
    needs_photo: yes(r.needs_photo), needs_gps: yes(r.needs_gps), questions: json(r.questions_json), deadline: day(r.deadline), status: r.status, total: Number(r.total) || 0 };
}
const taskRow = (E, id) => E.db.one('Tasks', { task_id: String(id || '') });
const PENDING = `(SELECT COUNT(*) FROM "Submissions" s WHERE s."task_id" = t."task_id" AND s."status" = 'pending')`;
const ACTIVE = `(SELECT COUNT(*) FROM "Submissions" s WHERE s."task_id" = t."task_id" AND s."status" IN ('pending', 'approved'))`;
async function resolve(E, planStr, uid) {
  const m = /^task:(\w+)$/.exec(String(planStr || '')); if (!m) return null;
  const r = await taskRow(E, m[1]); if (!r || r.status !== 'awaiting_payment' || (uid && String(r.owner_id) !== String(uid))) return null;
  return { id: 'task:' + r.task_id, label: String(r.title).slice(0, 40), days: 0, credits: 0, usd: Number(r.total), stars: Math.ceil(Number(r.total) * 75), task: r };
}
async function photoToOwner(A, E, sub, task, b64) {   // runs after the worker already has the answer
  const tok = await A.botToken(E); if (!tok) return;
  const text = 'New submission for "' + task.title + '". Open the app to review it.', open = { inline_keyboard: [[{ text: 'Open app', web_app: { url: A.APP_URL } }]] };
  if (!b64) return A.notify(E, task.owner_id, text);
  const bytes = A.b64bytes(b64), r = bytes && await A.tgCall(tok, 'sendPhoto', { chat_id: String(task.owner_id), caption: text, reply_markup: open }, { field: 'photo', bytes, mime: 'image/jpeg', name: sub + '.jpg' });
  const ph = r && r.ok && r.result && r.result.photo; if (!ph || !ph.length) return A.notify(E, task.owner_id, text);   // stays in D1
  await E.db.app.batch([E.db.app.prepare('UPDATE "Submissions" SET "photo_file" = ? WHERE "sub_id" = ?').bind('tg:' + ph[ph.length - 1].file_id, sub),
    E.db.app.prepare('DELETE FROM "Photos" WHERE "sub_id" = ?').bind(sub)]);
}

export default {
  id: 'market', url: 'https://axm-07.pages.dev', button: 'Field Tasks',
  defaults: { appName: 'Field Tasks', freeAllowance: 0, x_feePercent: 20, x_minWithdraw: 5, plans: [], x_refOn: false },
  schema: {
    Tasks: ['task_id', 'owner_id', 'title', 'instructions', 'city', 'reward', 'slots', 'filled', 'needs_photo', 'needs_gps', 'questions_json', 'deadline', 'status', 'fee_pct', 'total', 'created_at'],
    Submissions: ['sub_id', 'task_id', 'worker_id', 'photo_file', 'lat', 'lng', 'answers_json', 'status', 'reason', 'created_at', 'reviewed_at'],
    Workers: ['user_id', 'city', 'payout', 'balance', 'earned', 'updated_at'],
    Withdrawals: ['wd_id', 'user_id', 'amount', 'address', 'status', 'created_at', 'paid_at'],
    Photos: ['sub_id', 'mime', 'b64', 'created_at']
  },
  indexes: {
    Tasks: [[['task_id'], true], [['owner_id']], [['status']]],
    Submissions: [[['sub_id'], true], [['task_id', 'worker_id'], true], [['worker_id']]],
    Workers: [[['user_id'], true]], Withdrawals: [[['wd_id'], true], [['user_id']], [['status']]], Photos: [[['sub_id'], true]]
  },
  noExport: ['Photos'],   // pictures are not put in the nightly JSON backup
  async fileGet(id, A, E) {   // a signed /api/file?get=<sub_id> link from mkSubs
    const s = await E.db.one('Submissions', { sub_id: String(id) }); if (!s || !s.photo_file) return null;
    if (/^tg:/.test(s.photo_file)) {
      const tok = await A.botToken(E), f = tok && await A.tgCall(tok, 'getFile', { file_id: s.photo_file.slice(3) });
      if (!f || !f.ok || !f.result || !f.result.file_path) return null;
      const r = await fetch('https://api.telegram.org/file/bot' + tok + '/' + f.result.file_path); if (!r.ok) return null;
      return { bytes: new Uint8Array(await r.arrayBuffer()), mime: 'image/jpeg' };
    }
    const p = await E.db.one('Photos', { sub_id: s.sub_id }); return p ? { b64: p.b64, mime: p.mime || 'image/jpeg' } : null;
  },
  async resolvePlan(ctx, planStr) { return resolve(ctx.E, planStr, ctx.uid); },
  async planForOrder(o, A, E) { const m = /^task:(\w+)$/.exec(String(o.plan)), r = m && await taskRow(E, m[1]); return r ? { days: 0, task: r } : { days: 0 }; },
  async onPaid(o, plan, A, E) {
    const r = plan.task || await taskRow(E, String(o.plan).replace('task:', '')); if (!r) return '';
    await E.db.run('Tasks', 'UPDATE "Tasks" SET "status" = \'live\' WHERE "task_id" = ? AND "status" = \'awaiting_payment\'', r.task_id);
    await A.notify(E, r.owner_id, 'Payment received. "' + r.title + '" is now live.'); return '';
  },
  routes: {
    async mkFeed(ctx, req, A) {   // one database round: open tasks with their filled slots and whether I already did them
      const E = ctx.E, city = String(req.city || '').trim(), c = city.toLowerCase(), today = A.dayOf(new Date());
      const rows = await E.db.all('Tasks', `SELECT t.*, ${ACTIVE} AS active, EXISTS (SELECT 1 FROM "Submissions" s WHERE s."task_id" = t."task_id" AND s."worker_id" = ?) AS done FROM "Tasks" t WHERE t."status" = 'live' ORDER BY t.rowid`, ctx.uid);
      if (c) E.defer(E.db.run('Workers', 'INSERT INTO "Workers" ("user_id", "city", "payout", "balance", "earned", "updated_at") VALUES (?, ?, \'\', 0, 0, ?) ON CONFLICT("user_id") DO UPDATE SET "city" = excluded."city" WHERE "city" IS NOT excluded."city"',
        ctx.uid, city.slice(0, 60), A.iso(new Date())));   // remember the city without delaying the list
      return { ok: true, tasks: rows.filter((r) => String(r.owner_id) !== ctx.uid && !r.done && Number(r.active) < (Number(r.slots) || 0) && (!day(r.deadline) || day(r.deadline) >= today) && (!c || String(r.city).toLowerCase().indexOf(c) >= 0)).map(taskOut) };
    },
    async mkSubmit(ctx, req, A) {
      const E = ctx.E, r = await taskRow(E, req.task); if (!r || r.status !== 'live') return { ok: false, error: 'full' };
      const k = taskOut(r); if (String(r.owner_id) === ctx.uid) return { ok: false, error: 'own' };
      if (await E.db.one('Submissions', { task_id: k.id, worker_id: ctx.uid })) return { ok: false, error: 'already' };
      if (k.needs_photo && !req.photo) return { ok: false, error: 'e_photo' };
      if (k.needs_gps && !(num(req.lat) && num(req.lng))) return { ok: false, error: 'e_gps' };
      const answers = (req.answers || []).slice(0, k.questions.length).map((a) => String(a || '').slice(0, 300));
      if (answers.length < k.questions.length || answers.some((a) => !a.trim())) return { ok: false, error: 'e_answers' };
      const b64 = String(req.photo || '').replace(/^data:[^,]*,/, ''); if (b64.length > PHOTO_MAX) return { ok: false, error: 'too_large' };
      const sub = mkId('u'), now = A.iso(new Date()), db = E.db.app, stmts = [
        // the slot check and the insert are one statement: two workers can never take the last slot twice
        db.prepare(`INSERT INTO "Submissions" ("sub_id", "task_id", "worker_id", "photo_file", "lat", "lng", "answers_json", "status", "created_at")
          SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ? WHERE (SELECT COUNT(*) FROM "Submissions" WHERE "task_id" = ? AND "status" IN ('pending', 'approved')) < ?`)
          .bind(sub, k.id, ctx.uid, b64 ? 'd1' : '', num(req.lat) ? Number(req.lat) : '', num(req.lng) ? Number(req.lng) : '', JSON.stringify(answers), now, k.id, k.slots)];
      if (b64) stmts.push(db.prepare('INSERT INTO "Photos" ("sub_id", "mime", "b64", "created_at") SELECT ?, \'image/jpeg\', ?, ? WHERE EXISTS (SELECT 1 FROM "Submissions" WHERE "sub_id" = ?)').bind(sub, b64, now, sub));
      let out; try { out = await db.batch(stmts); } catch (e) { if (/UNIQUE/i.test(String(e && e.message || e))) return { ok: false, error: 'already' }; throw e; }
      if (!out[0].meta || !out[0].meta.changes) return { ok: false, error: 'full' };
      E.defer(photoToOwner(A, E, sub, r, b64));
      return { ok: true };
    },
    async mkMine(ctx) {
      const rows = await ctx.E.db.all('Tasks', `SELECT t.*, ${PENDING} AS pending FROM "Tasks" t WHERE t."owner_id" = ? ORDER BY t.rowid DESC`, ctx.uid);
      return { ok: true, feePercent: Number(ctx.st.x_feePercent) || 0, tasks: rows.map((r) => Object.assign(taskOut(r), { pending: Number(r.pending) || 0 })) };
    },
    async mkSaveTask(ctx, req) {
      const f = req.task || {}, fee = Number(ctx.st.x_feePercent) || 0, reward = Math.round(Number(f.reward) * 100) / 100, slots = Math.round(Number(f.slots));
      if (!f.title || !f.instructions || !f.city || !(reward >= 0.5) || !(slots >= 1 && slots <= 1000)) return { ok: false, error: 'fields' };
      const row = { task_id: mkId('k'), owner_id: ctx.uid, title: String(f.title).slice(0, 80), instructions: String(f.instructions).slice(0, 1500), city: String(f.city).slice(0, 60), reward, slots, filled: 0,
        needs_photo: !!f.needs_photo, needs_gps: !!f.needs_gps, questions_json: JSON.stringify((f.questions || []).slice(0, 3).map((q) => String(q).slice(0, 120))),
        deadline: String(f.deadline || '').slice(0, 10), status: ctx.st.testMode ? 'live' : 'awaiting_payment', fee_pct: fee, total: Math.round(reward * slots * (100 + fee)) / 100, created_at: new Date() };
      await ctx.E.db.ins('Tasks', row);
      return { ok: true, task: taskOut(row) };
    },
    async mkSubs(ctx, req, A) {
      const E = ctx.E, r = await taskRow(E, req.task); if (!r || String(r.owner_id) !== ctx.uid) return { ok: false, error: 'forbidden' };
      const subs = await E.db.sel('Submissions', { task_id: r.task_id }, { order: 'rowid DESC', limit: 50 });
      return { ok: true, subs: await Promise.all(subs.map(async (s) => ({ id: s.sub_id, worker: 'W-' + String(s.worker_id).slice(-4), photo: /^(d1|tg:)/.test(String(s.photo_file || '')) ? await A.fileUrl(E, s.sub_id) : '',
        lat: s.lat === null ? '' : s.lat, lng: s.lng === null ? '' : s.lng, answers: json(s.answers_json), status: s.status, reason: s.reason || '', created: A.iso(s.created_at) }))) };
    },
    async mkDecide(ctx, req, A) {
      const E = ctx.E, s = await E.db.one('Submissions', { sub_id: String(req.sub || '') }); if (!s || s.status !== 'pending') return { ok: false, error: 'state' };
      const r = await taskRow(E, s.task_id); if (!r || String(r.owner_id) !== ctx.uid) return { ok: false, error: 'forbidden' };
      const db = E.db.app, now = A.iso(new Date()), still = 'EXISTS (SELECT 1 FROM "Submissions" WHERE "sub_id" = ? AND "status" = \'pending\')';
      if (req.approve) {
        const reward = Number(r.reward) || 0;
        // one transaction: slot filled + worker paid + submission approved — or nothing, if someone decided first
        const out = await db.batch([
          db.prepare(`UPDATE "Tasks" SET "filled" = COALESCE("filled", 0) + 1, "status" = CASE WHEN COALESCE("filled", 0) + 1 >= CAST("slots" AS REAL) THEN 'closed' ELSE "status" END WHERE "task_id" = ? AND ${still}`).bind(r.task_id, s.sub_id),
          db.prepare(`INSERT INTO "Workers" ("user_id", "city", "payout", "balance", "earned", "updated_at") SELECT ?, '', '', ?, ?, ? WHERE ${still}
            ON CONFLICT("user_id") DO UPDATE SET "balance" = ROUND(COALESCE(CAST("balance" AS REAL), 0) + excluded."balance", 2), "earned" = ROUND(COALESCE(CAST("earned" AS REAL), 0) + excluded."earned", 2), "updated_at" = excluded."updated_at"`).bind(String(s.worker_id), reward, reward, now, s.sub_id),
          db.prepare('UPDATE "Submissions" SET "status" = \'approved\', "reviewed_at" = ? WHERE "sub_id" = ? AND "status" = \'pending\'').bind(now, s.sub_id)]);
        if (!out[2].meta || !out[2].meta.changes) return { ok: false, error: 'state' };
        E.defer(A.notify(E, s.worker_id, 'Approved: "' + r.title + '". $' + reward.toFixed(2) + ' added to your balance.'));
      } else {
        const c = await E.db.run('Submissions', 'UPDATE "Submissions" SET "status" = \'rejected\', "reason" = ?, "reviewed_at" = ? WHERE "sub_id" = ? AND "status" = \'pending\'', String(req.reason || '').slice(0, 200), now, s.sub_id);
        if (!c.meta || !c.meta.changes) return { ok: false, error: 'state' };
        E.defer(A.notify(E, s.worker_id, 'Not approved: "' + r.title + '"' + (req.reason ? ' — ' + String(req.reason).slice(0, 200) : '') + '.'));
      }
      return { ok: true };
    },
    async mkWallet(ctx, req, A) {
      const E = ctx.E, [w, wds, subs] = await Promise.all([E.db.one('Workers', { user_id: ctx.uid }), E.db.sel('Withdrawals', { user_id: ctx.uid }, { order: 'rowid DESC', limit: 20 }),
        E.db.all('Submissions', 'SELECT s."status", s."reason", s."created_at", t."title", t."reward" FROM "Submissions" s LEFT JOIN "Tasks" t ON t."task_id" = s."task_id" WHERE s."worker_id" = ? ORDER BY s.rowid DESC LIMIT 30', ctx.uid)]);
      return { ok: true, balance: Number(w && w.balance) || 0, earned: Number(w && w.earned) || 0, payout: (w && w.payout) || '', min: Number(ctx.st.x_minWithdraw) || 5,
        withdrawals: wds.map((x) => ({ id: x.wd_id, amount: Number(x.amount), status: x.status, created: A.iso(x.created_at) })),
        subs: subs.map((s) => ({ title: s.title, reward: Number(s.reward) || 0, status: s.status, reason: s.reason || '', created: A.iso(s.created_at) })) };
    },
    async mkWithdraw(ctx, req, A) {
      const E = ctx.E, addr = String(req.address || '').trim(); if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return { ok: false, error: 'address' };
      const w = await E.db.one('Workers', { user_id: ctx.uid }), bal = Number(w && w.balance) || 0, min = Number(ctx.st.x_minWithdraw) || 5; if (bal < min) return { ok: false, error: 'min' };
      const db = E.db.app, now = A.iso(new Date()), same = 'EXISTS (SELECT 1 FROM "Workers" WHERE "user_id" = ? AND CAST("balance" AS REAL) = ?)';
      // one transaction: the request is written and the balance emptied together, only if the balance did not change meanwhile
      const out = await db.batch([
        db.prepare(`INSERT INTO "Withdrawals" ("wd_id", "user_id", "amount", "address", "status", "created_at") SELECT ?, ?, ?, ?, 'requested', ? WHERE ${same}`).bind(mkId('w'), ctx.uid, bal, addr, now, ctx.uid, bal),
        db.prepare('UPDATE "Workers" SET "balance" = 0, "payout" = ?, "updated_at" = ? WHERE "user_id" = ? AND CAST("balance" AS REAL) = ?').bind(addr, now, ctx.uid, bal)]);
      if (!out[1].meta || !out[1].meta.changes) return { ok: false, error: 'min' };
      E.defer(A.notifyAdmins(E, 'Withdrawal request: $' + bal.toFixed(2) + ' to ' + addr + ' (user ' + ctx.uid + ').'));
      return { ok: true };
    },
    async adminMk(ctx, req, A) {
      const [wds, live] = await Promise.all([ctx.E.db.sel('Withdrawals', { status: 'requested' }), ctx.E.db.sel('Tasks', { status: 'live' })]);
      return { ok: true, withdrawals: wds.map((x) => ({ id: x.wd_id, user_id: x.user_id, amount: Number(x.amount), address: x.address, created: A.iso(x.created_at) })), tasks: live.map(taskOut) };
    },
    async adminMkWithdrawal(ctx, req, A) {
      const E = ctx.E, x = await E.db.one('Withdrawals', { wd_id: String(req.id || ''), status: 'requested' }); if (!x) return { ok: false, error: 'state' };
      const db = E.db.app, amount = Number(x.amount) || 0;
      if (req.paid) {
        const c = await E.db.run('Withdrawals', 'UPDATE "Withdrawals" SET "status" = \'paid\', "paid_at" = ? WHERE "wd_id" = ? AND "status" = \'requested\'', A.iso(new Date()), x.wd_id);
        if (!c.meta || !c.meta.changes) return { ok: false, error: 'state' };
        E.defer(A.notify(E, x.user_id, 'Your withdrawal of $' + amount.toFixed(2) + ' has been sent.'));
      } else {   // money goes back to the worker's balance, once
        const out = await db.batch([
          db.prepare(`INSERT INTO "Workers" ("user_id", "city", "payout", "balance", "earned", "updated_at") SELECT ?, '', '', ?, 0, ? WHERE EXISTS (SELECT 1 FROM "Withdrawals" WHERE "wd_id" = ? AND "status" = 'requested')
            ON CONFLICT("user_id") DO UPDATE SET "balance" = ROUND(COALESCE(CAST("balance" AS REAL), 0) + excluded."balance", 2), "updated_at" = excluded."updated_at"`).bind(String(x.user_id), amount, A.iso(new Date()), x.wd_id),
          db.prepare('UPDATE "Withdrawals" SET "status" = \'rejected\' WHERE "wd_id" = ? AND "status" = \'requested\'').bind(x.wd_id)]);
        if (!out[1].meta || !out[1].meta.changes) return { ok: false, error: 'state' };
        E.defer(A.notify(E, x.user_id, 'Your withdrawal request of $' + amount.toFixed(2) + ' was not sent. The amount is back in your balance.'));
      }
      return { ok: true };
    }
  }
};
