/* Shared Mini App kit: Telegram, i18n (SO/EN), API + DEMO backend, payments, admin settings.
   Injected into every app by tools/build.py. Apps call K.app({...}). */
var K = (function () {
'use strict';
var CFG = Object.assign({ appId: 'app', apiUrl: '', defaultLang: 'en', version: '1.0.0', botUsername: '', appShortName: '' }, window.APP_CONFIG || {});
var TG = (window.Telegram && window.Telegram.WebApp) || null, IN_TG = !!(TG && TG.initData), TGU = (IN_TG && TG.initDataUnsafe.user) || null;
var QS = new URLSearchParams(location.search), START = (IN_TG && TG.initDataUnsafe.start_param) || QS.get('startapp') || '';
var EDITION = /local/i.test(START) || QS.get('edition') === 'local' ? 'local' : 'global', DEMO = !CFG.apiUrl, MB = 1048576;
var LOCAL_METHODS = ['evc', 'zaad', 'sahal', 'mpesa'];
var APP = { strings: { en: {}, so: {} }, screens: {}, actions: {}, enter: {}, demo: {}, adminFields: [], extraSecrets: {} };
var S = { screen: 'home', stack: [], me: null, err: '', msg: '', pw: null, payPlan: null, payment: null, admin: null };

function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
/* start param helper: param('e') reads ?e=KEY or start_param e_KEY */
function param(p) { return QS.get(p) || (START.indexOf(p + '_') === 0 ? START.slice(p.length + 1) : ''); }

var L = {
en: {
  back: 'Back', settings: 'Settings', save: 'Save', saved: 'Saved', cancel: 'Cancel', copied: 'Copied', remove: 'Remove', edit: 'Edit', add: 'Add', done: 'Done', close: 'Close', share: 'Share', search: 'Search',
  e_gen: 'Something went wrong. Please try again.', e_net: 'Connection problem. Please try again.',
  demo_banner: 'Demo mode — no server connected. Data is saved on this device only.', test_banner: 'Test mode is ON — everyone has full access.',
  sim_banner: 'Simulating a free user on this device.',
  p_test: 'Test mode', p_pro: 'Pro', p_free: '{n} free left', p_credits: '{n} credits', p_none: 'Upgrade',
  pw_title: 'Upgrade', pw_text: 'Get full access.', f_unl: 'Unlimited use', f_all: 'All features included',
  choose_plan: 'Choose a plan', pay_with: 'Pay with', days: '{n} days', credits: '{n} credits', credit1: '1 credit',
  stars: 'Telegram Stars', usdt_trc20: 'USDT · TRC20', usdt_bep20: 'USDT · BEP20', evc: 'EVC Plus', zaad: 'Zaad', sahal: 'Sahal', mpesa: 'M-Pesa',
  send_exact: 'Send exactly this amount', network: 'Network', address: 'Address', amount: 'Amount',
  check_pay: 'I have paid — check now', not_yet: 'Not received yet. Blockchain confirmation can take a few minutes.',
  usdt_note: 'Send USDT on the {net} network only. The exact amount identifies your order.',
  mm_text: 'Send {a} to {n} using {m}, then enter the transaction ID below.', txid: 'Transaction ID', submit: 'Submit',
  pending: 'Submitted. Your access opens as soon as the payment is confirmed.',
  verify_phone: 'Verify phone number', verify_text: 'Local payment methods need a verified phone number.',
  paid_ok: 'Payment confirmed. Thank you.', no_methods: 'Payments are not set up yet. Please check back soon.',
  pay_demo: 'Demo: simulate a successful payment?', open_in_tg: 'Open this app inside Telegram to pay with Stars.', continue: 'Continue',
  my_plan: 'My plan', acc_status: 'Status', acc_free: 'Free plan', acc_used: 'Free uses', acc_exp: 'Expires', acc_id: 'Telegram ID', support: 'Support', upgrade: 'Upgrade',
  rep_ready: 'Your report is ready', rep_making: 'Preparing your PDF…', rep_dl: 'Download PDF', rep_send: 'Send to my Telegram chat', rep_sent: 'Sent to your Telegram chat', rep_hint: 'If the download does not start inside Telegram, use “Send to my Telegram chat”.', rep_pro: 'PDF reports are part of Pro.', generated: 'Generated', page: 'Page'
},
so: {
  back: 'Dib', settings: 'Dejinta', save: 'Keydi', saved: 'Waa la keydiyay', cancel: 'Jooji', copied: 'Waa la koobiyeeyay', remove: 'Ka saar', edit: 'Wax ka beddel', add: 'Ku dar', done: 'Dhammaad', close: 'Xir', share: 'La wadaag', search: 'Raadi',
  e_gen: 'Khalad ayaa dhacay. Fadlan isku day mar kale.', e_net: 'Dhibaato xiriir. Fadlan isku day mar kale.',
  demo_banner: 'Habka demo — server lama xirin. Xogta waxaa lagu keydiyaa qalabkan oo keliya.', test_banner: 'Habka tijaabada waa SHIDAN yahay — qof walba wuu isticmaali karaa.',
  sim_banner: 'Qalabkan wuxuu u dhaqmayaa sidii isticmaale bilaash ah.',
  p_test: 'Tijaabo', p_pro: 'Pro', p_free: '{n} bilaash ah ayaa haray', p_credits: '{n} dhibcood', p_none: 'U gudub Pro',
  pw_title: 'U gudub Pro', pw_text: 'Hel adeegga oo dhan.', f_unl: 'Isticmaal aan xad lahayn', f_all: 'Dhammaan adeegyada waa ku jiraan',
  choose_plan: 'Dooro qorshe', pay_with: 'Ku bixi', days: '{n} maalmood', credits: '{n} dhibcood', credit1: '1 dhibic',
  stars: 'Telegram Stars', usdt_trc20: 'USDT · TRC20', usdt_bep20: 'USDT · BEP20', evc: 'EVC Plus', zaad: 'Zaad', sahal: 'Sahal', mpesa: 'M-Pesa',
  send_exact: 'Dir qadarkan oo sax ah', network: 'Shabakadda', address: 'Cinwaanka', amount: 'Qadarka',
  check_pay: 'Waan bixiyay — hubi hadda', not_yet: 'Weli lama helin. Xaqiijintu waxay qaadan kartaa dhowr daqiiqo.',
  usdt_note: 'USDT ku dir shabakadda {net} oo keliya. Qadarka saxda ah ayaa aqoonsanaya dalabkaaga.',
  mm_text: 'U dir {a} lambarka {n} adigoo isticmaalaya {m}, kadib geli aqoonsiga macaamilka hoose.', txid: 'Aqoonsiga macaamilka', submit: 'Gudbi',
  pending: 'Waa la gudbiyay. Adeeggu wuu kuu furmayaa marka lacagta la xaqiijiyo.',
  verify_phone: 'Xaqiiji lambarka taleefanka', verify_text: 'Hababka lacag-bixinta gudaha waxay u baahan yihiin lambar la xaqiijiyay.',
  paid_ok: 'Lacag-bixinta waa la xaqiijiyay. Mahadsanid.', no_methods: 'Lacag-bixinta weli lama diyaarin. Fadlan dib u eeg.',
  pay_demo: 'Demo: ma la jilaa lacag-bixin guulaysatay?', open_in_tg: 'App-kan ka fur Telegram si aad Stars ugu bixiso.', continue: 'Sii wad',
  my_plan: 'Qorshahayga', acc_status: 'Xaaladda', acc_free: 'Qorshe bilaash', acc_used: 'Isticmaalka bilaashka', acc_exp: 'Wuxuu dhacayaa', acc_id: 'Aqoonsiga Telegram', support: 'Taageero', upgrade: 'U gudub Pro',
  rep_ready: 'Warbixintaadu waa diyaar', rep_making: 'PDF-ka ayaa la diyaarinayaa…', rep_dl: 'Soo deji PDF', rep_send: 'U dir sheekadayda Telegram', rep_sent: 'Waa loo diray sheekadaada Telegram', rep_hint: 'Haddii soo dejintu aysan ka bilaabmin Telegram, isticmaal “U dir sheekadayda Telegram”.', rep_pro: 'Warbixinnada PDF waxay ka mid yihiin Pro.', generated: 'La sameeyay', page: 'Bogga'
}};
var LANG;
function t(k, v) {
  var s = (APP.strings[LANG] && APP.strings[LANG][k]) || (L[LANG] && L[LANG][k]) || APP.strings.en[k] || L.en[k] || k;
  if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]);
  return s;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ic(n, c) { return '<svg class="i ' + (c || '') + '"><use href="#i-' + n + '"/></svg>'; }
function fmtDate(s) { var d = new Date(s); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }
function money(n, cur) { n = +n || 0; return (cur && cur !== 'USD' ? cur + ' ' : '$') + n.toFixed(2).replace(/\.00$/, ''); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
var toastT; function toast(m) { var el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); } el.textContent = m; el.classList.remove('hide'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.add('hide'); }, 2400); }
function copy(x) { (navigator.clipboard ? navigator.clipboard.writeText(x) : Promise.reject()).then(function () { toast(t('copied')); }, function () { var ta = document.createElement('textarea'); ta.value = x; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(t('copied')); } catch (e) {} ta.remove(); }); }
function openLink(u) { if (!u) return; if (IN_TG && /^https:\/\/t\.me\//.test(u)) TG.openTelegramLink(u); else if (IN_TG) TG.openLink(u); else window.open(u, '_blank'); }
function shareTg(url, text) { openLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text || '')); }
function haptic(k) { try { if (IN_TG) { if (k === 'ok') TG.HapticFeedback.notificationOccurred('success'); else TG.HapticFeedback.impactOccurred('light'); } } catch (e) {} }
function appLink(arg) {
  if (CFG.botUsername && CFG.appShortName) return 'https://t.me/' + CFG.botUsername + '/' + CFG.appShortName + (arg ? '?startapp=' + arg : '');
  if (CFG.botUsername) return 'https://t.me/' + CFG.botUsername + (arg ? '?start=' + arg : '');
  var i = arg ? arg.indexOf('_') : -1;
  return location.origin + location.pathname + (arg ? '?' + (i > 0 ? arg.slice(0, i) + '=' + arg.slice(i + 1) : 'startapp=' + arg) : '');
}
/* ---------------- PDF reports (shared engine) ----------------
   K.report({title, subtitle, meta:[[k,v]], rtl, blocks:[{h}, {kpis:[[label,value,tone]]}, {table:{cols:[{label,w,align}], rows:[[...]], total:[...]}},
   {text}, {images:[{src,caption}]}]}) -> Promise<Blob>. Pages are drawn on canvas (correct Arabic/Somali text) and wrapped with pdf-lib. */
var scriptCache = {};
function loadScript(src) { return scriptCache[src] || (scriptCache[src] = new Promise(function (r, j) { var s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = function () { delete scriptCache[src]; j(new Error('load')); }; document.head.appendChild(s); })); }
function loadImg(src) { return new Promise(function (r) { if (!src) return r(null); var im = new Image(); im.onload = function () { r(im); }; im.onerror = function () { r(null); }; im.src = src; }); }
function report(R) {
  var W = 1240, H = 1754, M = 90, rtl = !!R.rtl, ACC = '#2457d6', pages = [], c, x, y, pageNo = 0, FONT = 'Arial, "Noto Sans", sans-serif';
  var imgs = [];
  (R.blocks || []).forEach(function (b) { if (b.images) b.images.forEach(function (i) { imgs.push(i); }); });
  return Promise.all(imgs.map(function (i) { return loadImg(i.src).then(function (im) { i._im = im; }); })).then(function () {
    function X(px) { return rtl ? W - px : px; }
    function txt(s, px, py, font, color, align) { x.font = font; x.fillStyle = color || '#101828'; x.textAlign = align ? (rtl ? (align === 'left' ? 'right' : align === 'right' ? 'left' : 'center') : align) : (rtl ? 'right' : 'left'); x.fillText(String(s == null ? '' : s), X(px), py); }
    function fit(s, maxW, font) { x.font = font; s = String(s == null ? '' : s); if (x.measureText(s).width <= maxW) return s; while (s.length > 1 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; }
    function page() {
      c = document.createElement('canvas'); c.width = W; c.height = H; x = c.getContext('2d'); x.direction = rtl ? 'rtl' : 'ltr'; x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      pages.push(c); pageNo++; x.fillStyle = ACC; x.fillRect(0, 0, W, 14);
      if (pageNo === 1) {
        txt(R.brand || '', M, 70, '600 22px ' + FONT, '#667085');
        txt(R.title, M, 128, '700 46px ' + FONT, '#101828'); var yy = 170;
        if (R.subtitle) { txt(R.subtitle, M, yy, '400 26px ' + FONT, '#475467'); yy += 38; }
        (R.meta || []).forEach(function (m) { txt(m[0] + ': ' + m[1], M, yy, '400 22px ' + FONT, '#667085'); yy += 32; });
        y = yy + 16; x.fillStyle = '#e4e7ec'; x.fillRect(M, y, W - 2 * M, 2); y += 34;
      } else { txt(R.title, M, 64, '600 22px ' + FONT, '#667085'); y = 100; }
    }
    function need(h) { if (y + h > H - M - 50) { page(); return true; } return false; }
    function wrapText(s, font, lh, maxW) { x.font = font; String(s || '').split('\n').forEach(function (par) { var line = ''; par.split(' ').forEach(function (w) { var tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > maxW && line) { need(lh); txt(line, M, y + lh * 0.75, font); y += lh; line = w; } else line = tt; }); need(lh); txt(line, M, y + lh * 0.75, font); y += lh; }); }
    page();
    (R.blocks || []).forEach(function (b) {
      if (b.h) { need(80); y += 12; txt(b.h, M, y + 30, '700 28px ' + FONT, '#101828'); y += 52; }
      if (b.text) { wrapText(b.text, '400 23px ' + FONT, 34, W - 2 * M); y += 10; }
      if (b.kpis) {
        var n = Math.min(4, b.kpis.length), gap = 18, bw = (W - 2 * M - gap * (n - 1)) / n;
        for (var i = 0; i < b.kpis.length; i += n) { need(130);
          b.kpis.slice(i, i + n).forEach(function (k, j) { var bx = M + j * (bw + gap); x.fillStyle = '#f2f5fb'; x.fillRect(rtl ? W - bx - bw : bx, y, bw, 112);
            txt(fit(k[0], bw - 36, '600 20px ' + FONT), bx + 18, y + 38, '600 20px ' + FONT, '#667085');
            txt(fit(k[1], bw - 36, '700 34px ' + FONT), bx + 18, y + 88, '700 34px ' + FONT, k[2] === 'bad' ? '#d92d20' : k[2] === 'good' ? '#079455' : '#101828'); });
          y += 130; }
      }
      if (b.table) {
        var T = b.table, tw = W - 2 * M, cols = T.cols, tot = cols.reduce(function (a, cc) { return a + (cc.w || 1); }, 0), xs = [], acc = 0;
        cols.forEach(function (cc) { xs.push(M + acc / tot * tw); acc += cc.w || 1; });
        function head() { x.fillStyle = '#101828'; x.fillRect(M, y, tw, 44); cols.forEach(function (cc, i) { var cw = (cc.w || 1) / tot * tw; txt(fit(cc.label, cw - 20, '600 19px ' + FONT), cc.align === 'right' ? xs[i] + cw - 10 : xs[i] + 10, y + 29, '600 19px ' + FONT, '#fff', cc.align === 'right' ? 'right' : null); }); y += 44; }
        function row(r, bold, idx) { if (need(40)) head(); if (idx % 2) { x.fillStyle = '#f8f9fb'; x.fillRect(M, y, tw, 40); }
          var f = (bold ? '700 ' : '400 ') + '20px ' + FONT; cols.forEach(function (cc, i) { var cw = (cc.w || 1) / tot * tw, v = r[i], tone = null;
            if (v && typeof v === 'object') { tone = v.tone; v = v.v; }
            txt(fit(v, cw - 20, f), cc.align === 'right' ? xs[i] + cw - 10 : xs[i] + 10, y + 27, f, tone === 'bad' ? '#d92d20' : tone === 'good' ? '#079455' : '#101828', cc.align === 'right' ? 'right' : null); });
          y += 40; }
        need(90); head(); (T.rows || []).forEach(function (r, i) { row(r, false, i); });
        if (!T.rows || !T.rows.length) { need(40); txt(T.empty || '—', M + 10, y + 27, '400 20px ' + FONT, '#667085'); y += 40; }
        if (T.total) { x.fillStyle = '#101828'; x.fillRect(M, y, tw, 2); y += 4; row(T.total, true, 0); }
        y += 22;
      }
      if (b.images) {
        var per = 3, g = 16, iw = (W - 2 * M - g * (per - 1)) / per, ih = iw * 0.75;
        for (var k = 0; k < b.images.length; k += per) { need(ih + 50);
          b.images.slice(k, k + per).forEach(function (im, j) { var ix = M + j * (iw + g), rx = rtl ? W - ix - iw : ix; x.fillStyle = '#f2f4f7'; x.fillRect(rx, y, iw, ih);
            if (im._im) { var sc = Math.max(iw / im._im.width, ih / im._im.height), sw = iw / sc, shh = ih / sc; x.drawImage(im._im, (im._im.width - sw) / 2, (im._im.height - shh) / 2, sw, shh, rx, y, iw, ih); }
            txt(fit(im.caption || '', iw, '400 18px ' + FONT), ix, y + ih + 26, '400 18px ' + FONT, '#475467'); });
          y += ih + 44; }
      }
    });
    var stamp = t('generated') + ' ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    pages.forEach(function (pc, i) { x = pc.getContext('2d'); x.direction = rtl ? 'rtl' : 'ltr'; x.fillStyle = '#e4e7ec'; x.fillRect(M, H - M - 20, W - 2 * M, 1);
      txt(R.footer || stamp, M, H - M + 14, '400 18px ' + FONT, '#98a2b3'); txt(t('page') + ' ' + (i + 1) + ' / ' + pages.length, W - M, H - M + 14, '400 18px ' + FONT, '#98a2b3', 'right'); if (R.footer) txt(stamp, M, H - M + 40, '400 16px ' + FONT, '#98a2b3'); });
    return loadScript('vendor/pdf-lib.min.js');
  }).then(function () { return PDFLib.PDFDocument.create(); }).then(function (doc) {
    doc.setTitle(R.title); doc.setProducer(R.brand || 'Mini App'); var p = Promise.resolve();
    pages.forEach(function (pc) { p = p.then(function () { return fetch(pc.toDataURL('image/jpeg', 0.88)).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return doc.embedJpg(b); })
      .then(function (im) { doc.addPage([595.28, 841.89]).drawImage(im, { x: 0, y: 0, width: 595.28, height: 841.89 }); pc.width = pc.height = 0; }); }); });
    return p.then(function () { return doc.save(); });
  }).then(function (bytes) { return new Blob([bytes], { type: 'application/pdf' }); });
}
function saveBlob(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
/* Build a report and show the "report ready" screen. def = K.report() definition (or a function returning a Promise of one). */
function showReport(def, name) {
  S.rep = { busy: true, name: name }; go('report');
  Promise.resolve(typeof def === 'function' ? def() : def).then(report).then(function (b) { S.rep = { blob: b, name: name }; haptic('ok'); render(); })
    .catch(function (e) { console.error(e); S.rep = null; S.err = t('e_gen'); back(); });
}
function fileB64(file, maxPx, q) { // images are downscaled to save data on low-end phones
  return new Promise(function (res, rej) {
    if (!/^image\//.test(file.type) || !maxPx) { var fr = new FileReader(); fr.onload = function () { res({ b64: String(fr.result).split(',')[1], mime: file.type }); }; fr.onerror = rej; fr.readAsDataURL(file); return; }
    var u = URL.createObjectURL(file), im = new Image();
    im.onload = function () { var sc = Math.min(1, maxPx / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); var d = c.toDataURL('image/jpeg', q || 0.82); c.width = c.height = 0; res({ b64: d.split(',')[1], mime: 'image/jpeg', dataUrl: d }); };
    im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('img')); };
    im.src = u;
  });
}

/* ---------------- access (mirror of Core.gs) ---------------- */
function defaultSettings() {
  return Object.assign({ appName: 'App', testMode: true, freeAllowance: 2, freeMaxMB: 10, paidMaxMB: 100, supportContact: '', localPrefixes: '252', plans: [],
    methods: { stars: true, usdt_trc20: '', usdt_bep20: '', evc: '', zaad: '', sahal: '', mpesa: '' } }, JSON.parse(JSON.stringify(APP.defaults || {})));
}
function computeAccess(st, sub, freeUsed, simFree, credits) {
  var test = st.testMode && !simFree, s = sub && new Date(sub.expiry) > new Date() ? sub : null, allow = +st.freeAllowance || 0, left = Math.max(0, allow - freeUsed), cr = +credits || 0;
  return { entitled: !!(test || s || left > 0 || cr > 0), reason: test ? 'test' : s ? 'sub' : left > 0 ? 'free' : cr > 0 ? 'credits' : 'blocked',
    plan: s ? s.plan : null, expiry: s ? s.expiry : null, freeUsed: freeUsed, freeAllowance: allow, freeLeft: left, credits: cr, maxMB: (test || s) ? +st.paidMaxMB : +st.freeMaxMB, paidMaxMB: +st.paidMaxMB };
}
function availMethods(st, region) { var m = st.methods || {}, o = []; if (m.stars) o.push({ id: 'stars' }); if (m.usdt_trc20) o.push({ id: 'usdt_trc20' }); if (m.usdt_bep20) o.push({ id: 'usdt_bep20' });
  if (region === 'LOCAL') LOCAL_METHODS.forEach(function (k) { if (m[k]) o.push({ id: k, local: true }); }); return o; }

/* ---------------- DEMO backend (used when apiUrl is empty) ---------------- */
var DKEY = function () { return 'demo_' + CFG.appId + '_v1'; };
function dState() { var s = lsGet(DKEY(), null); if (!s) { s = { settings: defaultSettings(), freeUsed: 0, credits: 0, sub: null, orders: [], total: 0, app: APP.demoSeed ? APP.demoSeed() : {} }; }
  s.settings = Object.assign(defaultSettings(), s.settings); s.settings.methods = Object.assign(defaultSettings().methods, s.settings.methods || {}); return s; }
function dAccess(s, d) { return computeAccess(s.settings, s.sub, s.freeUsed, d.simulateFree, s.credits); }
function dRegion(s) { return EDITION === 'local' || s.phoneVerified ? 'LOCAL' : 'GLOBAL'; }
function dPlan(s, id) { if (APP.demoResolvePlan) { var p = APP.demoResolvePlan(id, s); if (p) return p; } return (s.settings.plans || []).filter(function (x) { return x.id === id; })[0]; }
function dMarkPaid(s, o) {
  if (o.status === 'paid') return; o.status = 'paid'; var p = dPlan(s, o.plan) || { days: 30 };
  if (APP.demoOnPaid && APP.demoOnPaid(o, p, s)) return;
  if (+p.credits > 0 && !(+p.days > 0)) { s.credits = (+s.credits || 0) + +p.credits; return; }
  var base = s.sub && new Date(s.sub.expiry) > new Date() ? new Date(s.sub.expiry) : new Date(); base.setDate(base.getDate() + (+p.days || 30)); s.sub = { plan: o.plan, expiry: base.toISOString() };
}
var DemoCore = {
  init: function (d, s) { var r = dRegion(s); return { ok: true, demo: true, verified: false, isAdmin: true, user: { id: TGU ? TGU.id : 0, name: TGU ? TGU.first_name : 'Demo user' }, region: r, phoneVerified: !!s.phoneVerified,
    access: dAccess(s, d), plans: (s.settings.plans || []).filter(function (p) { return p.region === 'ALL' || p.region === r; }), methods: availMethods(s.settings, r), appName: s.settings.appName, support: s.settings.supportContact }; },
  consume: function (d, s) { var a = dAccess(s, d); if (!a.entitled) return { ok: true, allowed: false, access: a }; if (a.reason === 'free') s.freeUsed++; else if (a.reason === 'credits') s.credits--; s.total++; return { ok: true, allowed: true, token: 'demo', access: dAccess(s, d) }; },
  createOrder: function (d, s) { var p = dPlan(s, d.plan); if (!p) return { ok: false, error: 'plan' };
    var o = { order_id: 'D' + uid(), plan: d.plan, method: d.method, status: 'pending' };
    if (d.method === 'stars') { o.amount = p.stars; o.currency = 'XTR'; }
    else if (/^usdt/.test(d.method)) { o.amount = (+p.usd + Math.floor(Math.random() * 9000 + 1000) / 1e6).toFixed(4); o.currency = 'USDT'; o.address = s.settings.methods[d.method]; o.network = d.method === 'usdt_trc20' ? 'TRC20 (Tron)' : 'BEP20 (BNB Smart Chain)'; }
    else { if (!s.phoneVerified) return { ok: false, error: 'phone_required' }; o.amount = '$' + (+p.usd).toFixed(2); o.currency = 'USD'; o.number = s.settings.methods[d.method]; }
    s.orders.push(o); return Object.assign({ ok: true }, o); },
  checkOrder: function (d, s) { var o = s.orders.filter(function (x) { return x.order_id === d.order_id; })[0]; return o ? { ok: true, status: o.status, access: dAccess(s, d) } : { ok: false, error: 'order' }; },
  demoPay: function (d, s) { var o = s.orders.filter(function (x) { return x.order_id === d.order_id; })[0]; if (o) dMarkPaid(s, o); return { ok: true, status: 'paid', access: dAccess(s, d) }; },
  submitManual: function (d, s) { var o = s.orders.filter(function (x) { return x.order_id === d.order_id; })[0]; o.status = 'review'; o.tx_ref = d.txid; return { ok: true, status: 'review' }; },
  demoVerifyPhone: function (d, s) { s.phoneVerified = true; return { ok: true }; },
  adminGet: function (d, s) { var sec = { BOT_TOKEN: false, TRONGRID_KEY: false, ETHERSCAN_KEY: false }; Object.keys(APP.extraSecrets).forEach(function (k) { sec[k] = !!(s.secrets || {})[k]; }); return { ok: true, settings: s.settings, secrets: sec }; },
  adminSave: function (d, s) { s.settings = Object.assign(defaultSettings(), d.settings); return { ok: true }; },
  adminSetSecret: function (d, s) { s.secrets = s.secrets || {}; s.secrets[d.key] = true; return { ok: true }; }, // never stores the value
  adminPending: function (d, s) { return { ok: true, items: s.orders.filter(function (x) { return x.status === 'review'; }).map(function (x) { return Object.assign({ user_id: 'demo' }, x); }) }; },
  adminDecide: function (d, s) { var o = s.orders.filter(function (x) { return x.order_id === d.order_id; })[0]; if (d.approve) dMarkPaid(s, o); else o.status = 'rejected'; return { ok: true }; },
  adminStats: function (d, s) { return { ok: true, stats: { users: 1, activeSubs: s.sub && new Date(s.sub.expiry) > new Date() ? 1 : 0, conversions: s.total, paidOrders: s.orders.filter(function (x) { return x.status === 'paid'; }).length, pending: s.orders.filter(function (x) { return x.status === 'review'; }).length } }; },
  adminResetMe: function (d, s) { s.freeUsed = 0; s.credits = 0; s.sub = null; s.phoneVerified = false; return { ok: true }; }
};
function demoCall(action, d) {
  return new Promise(function (res) { setTimeout(function () { var s = dState(), r;
    try { r = APP.demo[action] ? APP.demo[action](d, s) : DemoCore[action] ? DemoCore[action](d, s) : { ok: false, error: 'unknown_action' }; } catch (e) { console.error(e); r = { ok: false, error: e.message }; }
    lsSet(DKEY(), s); res(r); }, 150); });
}
function api(action, data) {
  data = Object.assign({}, data || {}); data.simulateFree = !!lsGet('simfree_' + CFG.appId, false);
  if (DEMO) return demoCall(action, data);
  return fetch(CFG.apiUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action: action, app: CFG.appId, edition: EDITION, initData: IN_TG ? TG.initData : '', start: START }, data)) })
    .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: 'network' }; });
}
function refreshMe() { return api('init').then(function (r) { if (r.ok) S.me = r; else if (!S.me) S.me = { access: computeAccess(defaultSettings(), null, 0, false, 0), plans: [], methods: [], error: r.error }; return S.me; }); }

/* ---------------- navigation & rendering ---------------- */
var $app;
function go(screen, opts) { if (S.screen !== screen && !(opts && opts.replace)) S.stack.push(S.screen); S.screen = screen; S.err = ''; S.msg = (opts && opts.msg) || ''; enter(); window.scrollTo(0, 0); }
function back() { S.screen = S.stack.pop() || 'home'; S.err = ''; S.msg = ''; enter(); }
function home() { S.stack = []; S.screen = 'home'; S.err = ''; enter(); }
function enter() { render(); var f = APP.enter[S.screen]; if (f) f(); else if (S.screen === 'settings') loadAdmin(); }
function header(title, sub, right) {
  var showBack = S.stack.length && !IN_TG;
  return '<div class="top">' + (showBack ? '<button class="ibtn" data-act="back" aria-label="' + t('back') + '">' + ic('back') + '</button>' : '<div class="logo">' + ic(APP.icon || 'logo') + '</div>') +
    '<div class="grow"><h1>' + esc(title) + '</h1>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' + (right || '') +
    '<div class="lang"><button data-lang="so" class="' + (LANG === 'so' ? 'on' : '') + '">SO</button><button data-lang="en" class="' + (LANG === 'en' ? 'on' : '') + '">EN</button></div>' +
    (S.me && S.me.isAdmin ? '<button class="ibtn" data-act="settings" aria-label="' + t('settings') + '">' + ic('settings') + '</button>' : '') + '</div>';
}
function banners() { var h = ''; if (DEMO) h += '<div class="banner">' + ic('info', 's') + '<span>' + t('demo_banner') + '</span></div>';
  if (S.me && S.me.access && S.me.access.reason === 'test') h += '<div class="banner">' + ic('shield', 's') + '<span>' + t('test_banner') + '</span></div>';
  if (lsGet('simfree_' + CFG.appId, false)) h += '<div class="banner">' + ic('user', 's') + '<span>' + t('sim_banner') + '</span></div>'; return h; }
function planChip() { var a = S.me && S.me.access; if (!a) return '';
  if (a.reason === 'test') return '<button class="chip" data-act="account">' + ic('shield', 's') + t('p_test') + '</button>';
  if (a.reason === 'sub') return '<button class="chip good" data-act="account">' + ic('check', 's') + t('p_pro') + '</button>';
  if (a.reason === 'credits') return '<button class="chip good" data-act="account">' + ic('star', 's') + t('p_credits', { n: a.credits }) + '</button>';
  if (a.reason === 'free') return '<button class="chip" data-act="account">' + ic('clock', 's') + t('p_free', { n: a.freeLeft }) + '</button>';
  return '<button class="chip warn" data-act="account">' + ic('lock', 's') + t('p_none') + '</button>'; }
function spin() { return '<div class="card center"><div class="spin" style="margin:0 auto;color:var(--accent)"></div></div>'; }
function errBox() { return (S.err ? '<div class="err">' + ic('alert', 's') + '<span>' + esc(S.err) + '</span></div>' : '') + (S.msg ? '<div class="okmsg">' + ic('check', 's') + '<span>' + esc(S.msg) + '</span></div>' : ''); }
function empty(icon, text, extra) { return '<div class="card center"><div class="big">' + ic(icon, 'l') + '</div><p class="m">' + text + '</p>' + (extra || '') + '</div>'; }
function kv(k, v, copyable) { return '<div class="kv"><div class="grow"><span class="k">' + k + '</span><code>' + esc(v) + '</code></div>' + (copyable ? '<button class="mini" data-copy="' + esc(v) + '">' + ic('copy') + '</button>' : '') + '</div>'; }
function seg(name, val, opts) { return '<div class="seg">' + opts.map(function (o) { return '<button data-seg="' + name + '" data-val="' + esc(o[0]) + '" class="' + (String(val) === String(o[0]) ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
function render() {
  if (IN_TG) { if (S.stack.length) TG.BackButton.show(); else TG.BackButton.hide(); }
  if (!S.me) { $app.innerHTML = '<div class="center" style="padding:80px 0"><div class="spin" style="margin:0 auto;color:var(--accent)"></div></div>'; return; }
  var f = APP.screens[S.screen] || BUILTIN[S.screen] || APP.screens.home;
  $app.innerHTML = f();
}

/* ---------------- payments UI ---------------- */
function paywall(ctx) { S.pw = ctx || {}; S.payPlan = null; go('paywall'); }
function planPrice(p) { return '<div class="price">' + (p.usd ? '$' + (+p.usd).toFixed(2) : '') + (p.stars ? '<small>' + p.stars + ' Stars</small>' : '') + '</div>'; }
function planSub(p) { return +p.days > 0 ? t('days', { n: p.days }) : +p.credits === 1 ? t('credit1') : +p.credits > 1 ? t('credits', { n: p.credits }) : ''; }
var BUILTIN = {
  paywall: function () {
    var me = S.me, pw = S.pw || {}, plans = pw.plans || me.plans, h = header(pw.title || t('pw_title'), '');
    if (!S.payPlan && plans[0]) S.payPlan = plans[0].id;
    h += '<div class="card"><div class="big">' + ic(pw.icon || 'lock', 'l') + '</div><h2 class="center">' + esc(pw.title || t('pw_title')) + '</h2><p class="m center">' + esc(pw.text || t('pw_text')) + '</p>' +
      '<ul class="feat">' + (pw.features || [t('f_unl'), t('f_all')]).map(function (f) { return '<li>' + ic('check') + esc(f) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="sec">' + t('choose_plan') + '</div><div class="opt">' + plans.map(function (p) { return '<div class="radio ' + (S.payPlan === p.id ? 'on' : '') + '" data-plan="' + esc(p.id) + '"><span class="dot"></span><div><b>' + esc(p.label) + '</b><div class="fs">' + planSub(p) + '</div></div>' + planPrice(p) + '</div>'; }).join('') + '</div>';
    h += '<div class="sec">' + t('pay_with') + '</div>';
    if (!me.methods.length) h += '<div class="card"><p class="m">' + t('no_methods') + '</p></div>';
    else h += '<div class="opt">' + me.methods.map(function (m) { return '<button class="radio" style="width:100%;text-align:left" data-method="' + m.id + '"><span class="thumb" style="width:34px;height:34px">' + ic(m.id === 'stars' ? 'star' : /^usdt/.test(m.id) ? 'wallet' : 'phone') + '</span><b class="grow">' + t(m.id) + '</b></button>'; }).join('') + '</div>';
    return h + errBox();
  },
  pay: function () {
    var o = S.payment, h = header(t(o.method), '');
    if (o.status === 'paid') return h + '<div class="card center"><div class="big good">' + ic('check', 'l') + '</div><h2>' + esc((S.pw && S.pw.paidText) || t('paid_ok')) + '</h2></div><button class="btn" data-act="afterpay">' + t('continue') + '</button>';
    if (o.status === 'review') return h + '<div class="card center"><div class="big">' + ic('clock', 'l') + '</div><p class="m">' + t('pending') + '</p></div><button class="btn ghost" data-act="home">' + t('close') + '</button>';
    if (o.phoneNeeded) return h + '<div class="card center"><div class="big">' + ic('phone', 'l') + '</div><p class="m">' + t('verify_text') + '</p></div><button class="btn" data-act="verifyphone">' + ic('phone') + t('verify_phone') + '</button>';
    if (/^usdt/.test(o.method)) h += '<div class="card"><p class="m" style="margin-bottom:12px">' + t('send_exact') + '</p>' + kv(t('amount'), o.amount + ' USDT', true).replace('data-copy="' + esc(o.amount + ' USDT') + '"', 'data-copy="' + esc(o.amount) + '"') +
      kv(t('network'), o.network) + kv(t('address'), o.address, true) + '<div class="note">' + ic('alert', 's') + '<span>' + t('usdt_note', { net: esc(o.network) }) + '</span></div></div><button class="btn" data-act="checkpay">' + ic('refresh') + t('check_pay') + '</button>';
    else h += '<div class="card"><p class="m" style="margin-bottom:12px">' + t('mm_text', { a: esc(o.amount), n: esc(o.number), m: t(o.method) }) + '</p>' + kv(t(o.method), o.number, true) + kv(t('amount'), o.amount) +
      '<label class="f">' + t('txid') + '</label><input class="t" id="txid" autocomplete="off"></div><button class="btn" data-act="submittx">' + t('submit') + '</button>';
    return h + errBox();
  },
  account: function () {
    var me = S.me, a = me.access, h = header(t('my_plan'), '');
    h += '<div class="card">' + kv(t('acc_status'), a.reason === 'test' ? t('p_test') : a.reason === 'sub' ? t('p_pro') + ' — ' + (a.plan || '') : a.reason === 'credits' ? t('p_credits', { n: a.credits }) : t('acc_free')) +
      (a.reason === 'sub' ? kv(t('acc_exp'), fmtDate(a.expiry)) : a.freeAllowance ? kv(t('acc_used'), a.freeUsed + ' / ' + a.freeAllowance) : '') +
      (me.user && me.user.id ? kv(t('acc_id'), me.user.id) : '') + (me.support ? kv(t('support'), me.support) : '') + '</div>';
    if (me.plans.length) h += '<button class="btn" data-act="paywall">' + ic('star') + t('upgrade') + '</button>';
    return h;
  },
  settings: function () { return renderSettings(); },
  report: function () {
    var r = S.rep || {}, h = header(t('rep_ready'), r.name || '');
    if (r.busy) return h + '<div class="card center"><div class="spin" style="margin:6px auto 10px;color:var(--accent)"></div><p class="m">' + t('rep_making') + '</p></div>';
    h += '<div class="card center"><div class="big good">' + ic('file', 'l') + '</div><h2>' + esc(r.name) + '</h2><p class="m">' + (r.blob ? Math.max(1, Math.round(r.blob.size / 1024)) + ' KB' : '') + '</p></div>';
    if (IN_TG && !DEMO) h += '<button class="btn" data-act="repsend">' + ic('send') + t('rep_send') + '</button>';
    h += '<button class="btn ' + (IN_TG && !DEMO ? 'sec2' : '') + '" data-act="repdl">' + ic('download') + t('rep_dl') + '</button>';
    if (IN_TG) h += '<div class="note" style="margin-top:12px">' + ic('info', 's') + '<span>' + t('rep_hint') + '</span></div>';
    return h + errBox();
  }
};
function startPayment(method) {
  S.err = '';
  if (method === 'stars' && !DEMO && !IN_TG) { S.err = t('open_in_tg'); return render(); }
  api('createOrder', { plan: S.payPlan, method: method }).then(function (r) {
    if (!r.ok) { if (r.error === 'phone_required') { S.payment = { method: method, phoneNeeded: true }; return go('pay'); } S.err = r.error === 'network' ? t('e_net') : t('e_gen'); return render(); }
    S.payment = r;
    if (method === 'stars') {
      if (DEMO) { if (confirm(t('pay_demo'))) api('demoPay', { order_id: r.order_id }).then(onPaid); return; }
      TG.openInvoice(r.invoiceLink, function (st) { if (st === 'paid') poll(r.order_id, 10); }); return;
    }
    go('pay');
  });
}
function poll(id, n) { api('checkOrder', { order_id: id }).then(function (r) { if (r.ok && r.status === 'paid') return onPaid(r); if (n > 0) setTimeout(function () { poll(id, n - 1); }, 2000); }); }
function onPaid() { haptic('ok'); S.payment = Object.assign(S.payment || {}, { status: 'paid' }); refreshMe().then(function () { if (S.screen !== 'pay') go('pay'); else render(); }); }

/* ---------------- admin settings ---------------- */
var SECRETS = { BOT_TOKEN: 'Telegram bot token', TRONGRID_KEY: 'TronGrid API key (TRC20 checks)', ETHERSCAN_KEY: 'Etherscan API key (BEP20 checks)' };
function loadAdmin() { S.admin = null; render(); Promise.all([api('adminGet'), api('adminPending'), api('adminStats'), APP.adminLoad ? APP.adminLoad() : Promise.resolve(null)]).then(function (r) {
  S.admin = { settings: r[0].settings || defaultSettings(), secrets: r[0].secrets || {}, pending: r[1].items || [], stats: (r[2] && r[2].stats) || {}, extra: r[3] }; if (!r[0].ok) toast(r[0].error || 'error'); render(); }); }
function renderSettings() {
  var A = S.admin, h = header('Settings', 'Admin only'); if (!A) return h + spin();
  var st = A.settings, m = st.methods, showPlans = APP.showPlans !== false;
  function inp(id, v, ph, ty) { return '<input class="t" data-set="' + id + '" type="' + (ty || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '">'; }
  function sw(id, on, l, s) { return '<div class="sw"><div><b style="font-size:14px">' + l + '</b>' + (s ? '<div class="fs">' + s + '</div>' : '') + '</div><button class="tgl ' + (on ? 'on' : '') + '" data-toggle="' + id + '"></button></div>'; }
  if (DEMO) h += '<div class="banner">' + ic('info', 's') + '<span>Demo mode: settings are saved on this device only. Put the Apps Script URL in config.js → apiUrl to go live.</span></div>';
  if (!DEMO && !S.me.verified) h += '<div class="banner">' + ic('alert', 's') + '<span>Server cannot verify Telegram yet. Add BOT_TOKEN_' + esc(CFG.appId) + ' and ADMIN_IDS in Script properties.</span></div>';
  h += '<div class="sec">General</div><div class="card">' + sw('testMode', st.testMode, 'Test mode', 'Everyone gets full access. Turn OFF at launch.') +
    '<label class="f">App name</label>' + inp('appName', st.appName) +
    (APP.freeLabel !== null ? '<label class="f">' + (APP.freeLabel || 'Free uses (total, no reset)') + '</label>' + inp('freeAllowance', st.freeAllowance, '2', 'number') : '') +
    '<label class="f">Support contact</label>' + inp('supportContact', st.supportContact, '@username') +
    '<label class="f">Local phone prefixes (comma separated)</label>' + inp('localPrefixes', st.localPrefixes, '252') +
    APP.adminFields.map(function (f) { return f.type === 'bool' ? sw('x:' + f.key, st[f.key], f.label, f.hint) : '<label class="f">' + esc(f.label) + '</label>' + inp(f.key, st[f.key], f.ph || '', f.type || 'text') + (f.hint ? '<div class="fs" style="margin-top:4px">' + esc(f.hint) + '</div>' : ''); }).join('') + '</div>';
  if (showPlans) h += '<div class="sec">Plans</div>' + (st.plans || []).map(function (p, i) { function pi(k, ty, step) { return '<input class="t" data-plan-i="' + i + '" data-k="' + k + '" type="' + (ty || 'text') + '"' + (step ? ' step="' + step + '"' : '') + ' value="' + esc(p[k] == null ? '' : p[k]) + '">'; }
    return '<div class="plan"><div class="full"><label class="f">Label</label>' + pi('label') + '</div><div><label class="f">Plan ID</label>' + pi('id') + '</div><div><label class="f">Region</label><select class="t" data-plan-i="' + i + '" data-k="region">' +
      ['GLOBAL', 'LOCAL', 'ALL'].map(function (r) { return '<option ' + (p.region === r ? 'selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="f">Days (0 = credits pack)</label>' + pi('days', 'number') + '</div><div><label class="f">Credits</label>' + pi('credits', 'number') + '</div>' +
      '<div><label class="f">Price USD</label>' + pi('usd', 'number', '0.01') + '</div><div><label class="f">Price Stars</label>' + pi('stars', 'number') + '</div>' +
      '<div class="full"><button class="btn sm ghost" style="width:100%" data-plan-rm="' + i + '">Remove plan</button></div></div>'; }).join('') + '<button class="btn sm sec2" data-act="addplan">' + ic('plus', 's') + 'Add plan</button>';
  h += '<div class="sec">Payment methods</div><div class="card">' + sw('m_stars', m.stars, 'Telegram Stars', 'Global. Needs bot token. Verify fees in Telegram docs before launch.') +
    '<label class="f">USDT TRC20 receive address</label>' + inp('m_usdt_trc20', m.usdt_trc20, 'T…') + '<label class="f">USDT BEP20 receive address</label>' + inp('m_usdt_bep20', m.usdt_bep20, '0x…') +
    '<div class="fs" style="margin:12px 0 0">Local only (hidden from global users, phone verification required):</div>' +
    '<label class="f">EVC Plus number</label>' + inp('m_evc', m.evc, '+252…') + '<label class="f">Zaad number</label>' + inp('m_zaad', m.zaad, '+252…') +
    '<label class="f">Sahal number</label>' + inp('m_sahal', m.sahal, '+252…') + '<label class="f">M-Pesa number</label>' + inp('m_mpesa', m.mpesa, '+254…') + '</div>';
  h += '<button class="btn" data-act="savesettings">' + ic('check') + 'Save settings</button>' + errBox();
  var secs = Object.assign({}, SECRETS, APP.extraSecrets);
  h += '<div class="sec">Secrets (write-only)</div><div class="card"><div class="fs" style="margin-bottom:8px">Stored only on the server (Apps Script properties). Values are never shown again.</div>' +
    Object.keys(secs).map(function (k) { return '<label class="f">' + esc(secs[k]) + ' — <span style="color:' + (A.secrets[k] ? 'var(--ok)' : 'var(--danger)') + '">' + (A.secrets[k] ? 'set' : 'not set') + '</span></label><div class="row"><input class="t" type="password" autocomplete="off" id="sec_' + k + '" placeholder="Paste new value"><button class="btn sm sec2" data-secret="' + k + '">Save</button></div>'; }).join('') + '</div>';
  h += '<div class="sec">Payments to review</div><div class="card">' + (A.pending.length ? '<ul class="files">' + A.pending.map(function (p) { return '<li><div class="grow"><div class="fn">' + esc(p.method) + ' · ' + esc(p.amount) + ' · ' + esc(p.plan) + '</div><div class="fs">User ' + esc(p.user_id) + ' · Tx ' + esc(p.tx_ref) + '</div></div><button class="btn sm" data-approve="' + esc(p.order_id) + '">Approve</button><button class="btn sm ghost" data-reject="' + esc(p.order_id) + '">Reject</button></li>'; }).join('') + '</ul>' : '<p class="m">Nothing to review.</p>') + '</div>';
  var s = A.stats; h += '<div class="sec">Stats</div><div class="card stat"><div><b>' + (s.users || 0) + '</b><span>Users</span></div><div><b>' + (s.activeSubs || 0) + '</b><span>Active subscriptions</span></div><div><b>' + (s.conversions || 0) + '</b><span>Uses</span></div><div><b>' + (s.paidOrders || 0) + '</b><span>Paid orders</span></div></div>';
  if (APP.adminExtra) h += APP.adminExtra(A.extra);
  h += '<div class="sec">Testing</div><div class="card">' + sw('simfree', lsGet('simfree_' + CFG.appId, false), 'Simulate free user (this device)', 'Ignores test mode so you can try the free limit and the paywall.') +
    '<button class="btn sm ghost" style="width:100%;margin-top:8px" data-act="resetme">Reset my usage, credits &amp; subscription</button>' + (S.me.plans.length ? '<button class="btn sm ghost" style="width:100%;margin-top:8px" data-act="paywall">Preview paywall</button>' : '') + '</div>';
  return h;
}
function collectSettings() {
  var st = JSON.parse(JSON.stringify(S.admin.settings));
  document.querySelectorAll('[data-set]').forEach(function (el) { var k = el.dataset.set, v = el.type === 'number' ? +el.value : el.value.trim(); if (k.indexOf('m_') === 0) st.methods[k.slice(2)] = v; else st[k] = v; });
  document.querySelectorAll('[data-plan-i]').forEach(function (el) { var p = st.plans[+el.dataset.planI], k = el.dataset.k; p[k] = el.type === 'number' ? +el.value : el.value.trim(); });
  return st;
}

/* ---------------- events ---------------- */
function needAccess(fn, pwCtx) { var a = S.me.access; if (a.entitled) return fn(); paywall(pwCtx); }
function consume(tool) { return api('consume', { tool: tool }).then(function (r) { if (r.ok && r.access) S.me.access = r.access; return r; }); }
document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-a],[data-act],[data-lang],[data-copy],[data-open],[data-plan],[data-method],[data-toggle],[data-plan-rm],[data-secret],[data-approve],[data-reject],[data-seg],[data-go]'); if (!el) return;
  var d = el.dataset;
  if (d.a) { var fa = APP.actions[d.a]; if (fa) fa(el, d); return; }
  if (d.seg) { if (APP.onSeg) APP.onSeg(d.seg, d.val, el); return; }
  if (d.go) return go(d.go);
  if (d.lang) { LANG = d.lang; lsSet('lang_' + CFG.appId, LANG); document.documentElement.lang = LANG; return render(); }
  if (d.copy != null) return copy(d.copy);
  if (d.open != null) return openLink(d.open);
  if (d.plan) { S.payPlan = d.plan; return render(); }
  if (d.method) return startPayment(d.method);
  if (d.toggle) { if (d.toggle === 'simfree') { lsSet('simfree_' + CFG.appId, !lsGet('simfree_' + CFG.appId, false)); refreshMe().then(render); return; }
    S.admin.settings = collectSettings(); var st = S.admin.settings;
    if (d.toggle === 'testMode') st.testMode = !st.testMode; else if (d.toggle === 'm_stars') st.methods.stars = !st.methods.stars; else if (d.toggle.indexOf('x:') === 0) st[d.toggle.slice(2)] = !st[d.toggle.slice(2)]; return render(); }
  if (d.planRm != null) { S.admin.settings = collectSettings(); S.admin.settings.plans.splice(+d.planRm, 1); return render(); }
  if (d.secret) { var i = document.getElementById('sec_' + d.secret); if (!i.value.trim()) return; api('adminSetSecret', { key: d.secret, value: i.value.trim() }).then(function (r) { i.value = ''; toast(r.ok ? 'Saved' : (r.error || 'Error')); if (r.ok) { S.admin.secrets[d.secret] = true; render(); } }); return; }
  if (d.approve || d.reject) { api('adminDecide', { order_id: d.approve || d.reject, approve: !!d.approve }).then(function (r) { toast(r.ok ? 'Done' : (r.error || 'Error')); loadAdmin(); }); return; }
  switch (d.act) {
    case 'back': return back();
    case 'home': return home();
    case 'settings': return go('settings');
    case 'account': return go('account');
    case 'paywall': return paywall();
    case 'afterpay': if (S.pw && S.pw.after) return S.pw.after(); return home();
    case 'addplan': S.admin.settings = collectSettings(); S.admin.settings.plans.push({ id: 'plan_' + (S.admin.settings.plans.length + 1), label: 'New plan', days: 30, credits: 0, usd: 1, stars: 75, region: 'GLOBAL' }); return render();
    case 'savesettings': var st2 = collectSettings(); api('adminSave', { settings: st2 }).then(function (r) { if (r.ok) { S.admin.settings = st2; S.msg = 'Saved'; refreshMe().then(render); } else toast(r.error || 'Error'); }); return;
    case 'repdl': if (S.rep && S.rep.blob) saveBlob(S.rep.blob, S.rep.name); return;
    case 'repsend': if (!S.rep || !S.rep.blob) return; toast('…');
      var fr = new FileReader(); fr.onload = function () { api('sendReport', { name: S.rep.name, data: String(fr.result).split(',')[1] }).then(function (r) {
        if (r.ok) { toast(t('rep_sent')); haptic('ok'); } else if (r.error === 'write_access' && TG.requestWriteAccess) TG.requestWriteAccess(); else toast(t('e_gen')); }); }; fr.readAsDataURL(S.rep.blob); return;
    case 'resetme': api('adminResetMe').then(function () { refreshMe().then(function () { toast('Reset'); render(); }); }); return;
    case 'checkpay': api('checkOrder', { order_id: S.payment.order_id }).then(function (r) { if (r.ok && r.status === 'paid') return onPaid(r);
        if (DEMO && confirm(t('pay_demo'))) return api('demoPay', { order_id: S.payment.order_id }).then(onPaid); S.err = t('not_yet'); render(); }); return;
    case 'submittx': var tx = document.getElementById('txid').value.trim(); if (tx.length < 4) { S.err = t('txid'); return render(); }
      api('submitManual', { order_id: S.payment.order_id, txid: tx }).then(function (r) { if (r.ok) S.payment.status = 'review'; else S.err = t('e_gen'); render(); }); return;
    case 'verifyphone': var after = function () { refreshMe().then(function () { back(); }); };
      if (DEMO) { api('demoVerifyPhone').then(after); return; } if (IN_TG && TG.requestContact) TG.requestContact(function (ok) { if (ok) setTimeout(after, 1500); }); return;
  }
});

function app(def) {
  Object.keys(def).forEach(function (k) { APP[k] = def[k]; });
  APP.strings = def.strings || { en: {}, so: {} }; APP.screens = def.screens || {}; APP.actions = def.actions || {}; APP.enter = def.enter || {}; APP.demo = def.demo || {};
  APP.adminFields = def.adminFields || []; APP.extraSecrets = def.extraSecrets || {};
  LANG = lsGet('lang_' + CFG.appId, null) || (EDITION === 'local' || (TGU && TGU.language_code === 'so') ? 'so' : CFG.defaultLang);
  document.documentElement.lang = LANG;
  $app = document.getElementById('app');
  if (IN_TG) { TG.BackButton.onClick(back); try { TG.ready(); TG.expand(); if (TG.isVersionAtLeast('7.7')) TG.disableVerticalSwipes(); } catch (e) {} }
  if (def.startScreen) S.screen = def.startScreen();
  render();
  refreshMe().then(function () { enter(); });
}

return { app: app, report: report, showReport: showReport, saveBlob: saveBlob, loadScript: loadScript, isPro: function () { return S.me && /^(sub|test)$/.test(S.me.access.reason); }, CFG: CFG, TG: TG, IN_TG: IN_TG, TGU: TGU, QS: QS, START: START, EDITION: EDITION, DEMO: DEMO, MB: MB, S: S,
  t: t, esc: esc, ic: ic, fmtDate: fmtDate, money: money, uid: uid, toast: toast, copy: copy, openLink: openLink, shareTg: shareTg, haptic: haptic, appLink: appLink, param: param, fileB64: fileB64,
  lsGet: lsGet, lsSet: lsSet, api: api, refreshMe: refreshMe, go: go, back: back, home: home, render: render, header: header, banners: banners, planChip: planChip, spin: spin, errBox: errBox, empty: empty, kv: kv, seg: seg,
  paywall: paywall, needAccess: needAccess, consume: consume, lang: function () { return LANG; } };
})();
