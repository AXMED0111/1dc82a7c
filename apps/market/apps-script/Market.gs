/**
 * APP #7 — FIELD DATA MARKETPLACE ("Field Tasks")
 * Apps Script project = Core.gs + this file. Script properties: BOT_TOKEN_market, ADMIN_IDS.
 * Businesses fund a task up front (rewards × submissions + platform fee) using the core payment methods.
 * Workers submit photo / GPS / answers; approved work is credited to the worker's balance; the admin pays
 * withdrawals in USDT manually and marks them paid. Photos are stored in a private Google Drive folder.
 */
var THIS_APP = { id: 'market', url: 'https://mark-4be4295c.netlify.app', button: 'Field Tasks' };
var EXTRA_SCHEMA = EXTRA_SCHEMA || {}, APP_HOOKS = APP_HOOKS || {}, APP_DEFAULTS = APP_DEFAULTS || {};

APP_DEFAULTS.market = { appName: 'Field Tasks', freeAllowance: 0, x_feePercent: 20, x_minWithdraw: 5, plans: [], x_refOn: false };
EXTRA_SCHEMA.Tasks = ['task_id','owner_id','title','instructions','city','reward','slots','filled','needs_photo','needs_gps','questions_json','deadline','status','fee_pct','total','created_at'];
EXTRA_SCHEMA.Submissions = ['sub_id','task_id','worker_id','photo_file','lat','lng','answers_json','status','reason','created_at','reviewed_at'];
EXTRA_SCHEMA.Workers = ['user_id','city','payout','balance','earned','updated_at'];
EXTRA_SCHEMA.Withdrawals = ['wd_id','user_id','amount','address','status','created_at','paid_at'];

function mkId(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function mkBool(v) { return v === true || v === 'TRUE'; }
function mkTask(r) { return { id: r.task_id, title: r.title, instructions: r.instructions, city: r.city, reward: Number(r.reward) || 0, slots: Number(r.slots) || 0, filled: Number(r.filled) || 0,
  needs_photo: mkBool(r.needs_photo), needs_gps: mkBool(r.needs_gps), questions: JSON.parse(r.questions_json || '[]'), deadline: r.deadline instanceof Date ? Utilities.formatDate(r.deadline, 'UTC', 'yyyy-MM-dd') : String(r.deadline || ''),
  status: r.status, total: Number(r.total) || 0 }; }
function mkTaskRow(id) { return find('Tasks', function (x) { return x.task_id === id; }); }
function mkWorker(uid) {
  var w = find('Workers', function (x) { return String(x.user_id) === String(uid); });
  if (!w) { append('Workers', { user_id: String(uid), city: '', payout: '', balance: 0, earned: 0, updated_at: new Date() }); w = find('Workers', function (x) { return String(x.user_id) === String(uid); }); }
  return w;
}
function mkActive(taskId) { return rows('Submissions').filter(function (s) { return s.task_id === taskId && (s.status === 'pending' || s.status === 'approved'); }).length; }
function mkFolder() {
  var id = prop('MK_PHOTO_FOLDER'), f;
  if (id) try { return DriveApp.getFolderById(id); } catch (e) {}
  f = DriveApp.createFolder('field-photos-' + Utilities.getUuid().slice(0, 6)); setProp('MK_PHOTO_FOLDER', f.getId()); return f;
}
function mkResolve(planStr, uid) {
  var m = /^task:(\w+)$/.exec(String(planStr || '')); if (!m) return null;
  var r = mkTaskRow(m[1]); if (!r || r.status !== 'awaiting_payment' || (uid && String(r.owner_id) !== String(uid))) return null;
  return { id: 'task:' + r.task_id, label: String(r.title).slice(0, 40), days: 0, credits: 0, usd: Number(r.total), stars: Math.ceil(Number(r.total) * 75), task: r };
}

APP_HOOKS.market = {
  resolvePlan: function (ctx, planStr) { return mkResolve(planStr, ctx.uid); },
  planForOrder: function (o) { var m = /^task:(\w+)$/.exec(String(o.plan)); var r = m && mkTaskRow(m[1]); return r ? { days: 0, task: r } : { days: 0 }; },
  onPaid: function (o, plan) {
    var r = plan.task || mkTaskRow(String(o.plan).replace('task:', '')); if (!r) return '';
    update('Tasks', r, { status: 'live' }); notify('market', r.owner_id, 'Payment received. "' + r.title + '" is now live.'); return '';
  },
  routes: {
    mkFeed: function (ctx, req) {
      var c = String(req.city || '').toLowerCase().trim(), today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
      if (c) { var w = mkWorker(ctx.uid); if (w.city !== req.city) update('Workers', w, { city: String(req.city).slice(0, 60) }); }
      var done = {}; rows('Submissions').forEach(function (s) { if (String(s.worker_id) === ctx.uid) done[s.task_id] = 1; });
      return { ok: true, tasks: rows('Tasks').map(function (r) { var k = mkTask(r); k._owner = String(r.owner_id); return k; }).filter(function (k) {
        return k.status === 'live' && k._owner !== ctx.uid && !done[k.id] && mkActive(k.id) < k.slots && (!k.deadline || k.deadline >= today) && (!c || String(k.city).toLowerCase().indexOf(c) >= 0);
      }).map(function (k) { delete k._owner; return k; }) };
    },
    mkSubmit: function (ctx, req) {
      var r = mkTaskRow(req.task); if (!r || r.status !== 'live') return { ok: false, error: 'full' };
      var k = mkTask(r);
      if (String(r.owner_id) === ctx.uid) return { ok: false, error: 'own' };
      var lock = LockService.getScriptLock(); lock.waitLock(15000); _rc = {};
      try {
        if (find('Submissions', function (s) { return s.task_id === k.id && String(s.worker_id) === ctx.uid; })) return { ok: false, error: 'already' };
        if (mkActive(k.id) >= k.slots) return { ok: false, error: 'full' };
        if (k.needs_photo && !req.photo) return { ok: false, error: 'e_photo' };
        if (k.needs_gps && !(isFinite(req.lat) && isFinite(req.lng) && req.lat !== null)) return { ok: false, error: 'e_gps' };
        var answers = (req.answers || []).slice(0, k.questions.length).map(function (a) { return String(a || '').slice(0, 300); });
        if (answers.length < k.questions.length || answers.some(function (a) { return !a.trim(); })) return { ok: false, error: 'e_answers' };
        var fileId = '';
        if (req.photo) {
          var bytes = Utilities.base64Decode(String(req.photo)); if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: 'too_large' };
          fileId = mkFolder().createFile(Utilities.newBlob(bytes, 'image/jpeg', k.id + '-' + ctx.uid + '.jpg')).getId();
        }
        append('Submissions', { sub_id: mkId('u'), task_id: k.id, worker_id: ctx.uid, photo_file: fileId, lat: req.lat || '', lng: req.lng || '', answers_json: JSON.stringify(answers), status: 'pending', created_at: new Date() });
      } finally { lock.releaseLock(); }
      notify('market', r.owner_id, 'New submission for "' + r.title + '". Open the app to review it.');
      return { ok: true };
    },
    mkMine: function (ctx) {
      var subs = rows('Submissions');
      return { ok: true, feePercent: Number(ctx.st.x_feePercent) || 0, tasks: rows('Tasks').filter(function (r) { return String(r.owner_id) === ctx.uid; }).reverse().map(function (r) {
        var k = mkTask(r); k.pending = subs.filter(function (s) { return s.task_id === k.id && s.status === 'pending'; }).length; return k; }) };
    },
    mkSaveTask: function (ctx, req) {
      var f = req.task || {}, fee = Number(ctx.st.x_feePercent) || 0, reward = Math.round(Number(f.reward) * 100) / 100, slots = Math.round(Number(f.slots));
      if (!f.title || !f.instructions || !f.city || !(reward >= 0.5) || !(slots >= 1 && slots <= 1000)) return { ok: false, error: 'fields' };
      var id = mkId('k'), total = Math.round(reward * slots * (100 + fee)) / 100;
      append('Tasks', { task_id: id, owner_id: ctx.uid, title: String(f.title).slice(0, 80), instructions: String(f.instructions).slice(0, 1500), city: String(f.city).slice(0, 60), reward: reward, slots: slots, filled: 0,
        needs_photo: !!f.needs_photo, needs_gps: !!f.needs_gps, questions_json: JSON.stringify((f.questions || []).slice(0, 3).map(function (q) { return String(q).slice(0, 120); })),
        deadline: String(f.deadline || '').slice(0, 10), status: ctx.st.testMode ? 'live' : 'awaiting_payment', fee_pct: fee, total: total, created_at: new Date() });
      return { ok: true, task: mkTask(mkTaskRow(id)) };
    },
    mkSubs: function (ctx, req) {
      var r = mkTaskRow(req.task); if (!r || String(r.owner_id) !== ctx.uid) return { ok: false, error: 'forbidden' };
      return { ok: true, subs: rows('Submissions').filter(function (s) { return s.task_id === r.task_id; }).reverse().slice(0, 50).map(function (s) {
        var photo = ''; if (s.photo_file) try { photo = 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(s.photo_file).getBlob().getBytes()); } catch (e) {}
        return { id: s.sub_id, worker: 'W-' + String(s.worker_id).slice(-4), photo: photo, lat: s.lat, lng: s.lng, answers: JSON.parse(s.answers_json || '[]'), status: s.status, reason: s.reason, created: iso(s.created_at) }; }) };
    },
    mkDecide: function (ctx, req) {
      var lock = LockService.getScriptLock(); lock.waitLock(15000); _rc = {};
      try {
        var s = find('Submissions', function (x) { return x.sub_id === req.sub; }); if (!s || s.status !== 'pending') return { ok: false, error: 'state' };
        var r = mkTaskRow(s.task_id); if (!r || String(r.owner_id) !== ctx.uid) return { ok: false, error: 'forbidden' };
        if (req.approve) {
          update('Submissions', s, { status: 'approved', reviewed_at: new Date() });
          var filled = (Number(r.filled) || 0) + 1; update('Tasks', r, { filled: filled, status: filled >= Number(r.slots) ? 'closed' : r.status });
          var w = mkWorker(s.worker_id); update('Workers', w, { balance: Math.round(((Number(w.balance) || 0) + Number(r.reward)) * 100) / 100, earned: Math.round(((Number(w.earned) || 0) + Number(r.reward)) * 100) / 100, updated_at: new Date() });
          notify('market', s.worker_id, 'Approved: "' + r.title + '". $' + Number(r.reward).toFixed(2) + ' added to your balance.');
        } else {
          update('Submissions', s, { status: 'rejected', reason: String(req.reason || '').slice(0, 200), reviewed_at: new Date() });
          notify('market', s.worker_id, 'Not approved: "' + r.title + '"' + (req.reason ? ' — ' + String(req.reason).slice(0, 200) : '') + '.');
        }
      } finally { lock.releaseLock(); }
      return { ok: true };
    },
    mkWallet: function (ctx) {
      var w = mkWorker(ctx.uid), tasks = {}; rows('Tasks').forEach(function (r) { tasks[r.task_id] = r; });
      return { ok: true, balance: Number(w.balance) || 0, earned: Number(w.earned) || 0, payout: w.payout, min: Number(ctx.st.x_minWithdraw) || 5,
        withdrawals: rows('Withdrawals').filter(function (x) { return String(x.user_id) === ctx.uid; }).reverse().slice(0, 20).map(function (x) { return { id: x.wd_id, amount: Number(x.amount), status: x.status, created: iso(x.created_at) }; }),
        subs: rows('Submissions').filter(function (s) { return String(s.worker_id) === ctx.uid; }).reverse().slice(0, 30).map(function (s) { var k = tasks[s.task_id] || {};
          return { title: k.title, reward: Number(k.reward) || 0, status: s.status, reason: s.reason, created: iso(s.created_at) }; }) };
    },
    mkWithdraw: function (ctx, req) {
      var addr = String(req.address || '').trim(); if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return { ok: false, error: 'address' };
      var lock = LockService.getScriptLock(); lock.waitLock(15000); _rc = {};
      try {
        var w = mkWorker(ctx.uid), bal = Number(w.balance) || 0, min = Number(ctx.st.x_minWithdraw) || 5; if (bal < min) return { ok: false, error: 'min' };
        update('Workers', w, { balance: 0, payout: addr, updated_at: new Date() });
        append('Withdrawals', { wd_id: mkId('w'), user_id: ctx.uid, amount: bal, address: addr, status: 'requested', created_at: new Date() });
      } finally { lock.releaseLock(); }
      notifyAdmins('market', 'Withdrawal request: $' + bal.toFixed(2) + ' to ' + addr + ' (user ' + ctx.uid + ').');
      return { ok: true };
    },
    adminMk: function (ctx) {
      return { ok: true, withdrawals: rows('Withdrawals').filter(function (x) { return x.status === 'requested'; }).map(function (x) { return { id: x.wd_id, user_id: x.user_id, amount: Number(x.amount), address: x.address, created: iso(x.created_at) }; }),
        tasks: rows('Tasks').filter(function (r) { return r.status === 'live'; }).map(mkTask) };
    },
    adminMkWithdrawal: function (ctx, req) {
      var x = find('Withdrawals', function (r) { return r.wd_id === req.id && r.status === 'requested'; }); if (!x) return { ok: false, error: 'state' };
      if (req.paid) { update('Withdrawals', x, { status: 'paid', paid_at: new Date() }); notify('market', x.user_id, 'Your withdrawal of $' + Number(x.amount).toFixed(2) + ' has been sent.'); }
      else { update('Withdrawals', x, { status: 'rejected' }); var w = mkWorker(x.user_id); update('Workers', w, { balance: (Number(w.balance) || 0) + Number(x.amount) }); }
      return { ok: true };
    }
  }
};
