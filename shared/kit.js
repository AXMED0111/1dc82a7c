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
  q_saving: 'Saving {n}…', q_wait: '{n} waiting for connection', q_fail: 'A change could not be saved. Please check it.',
  e_gen: 'Something went wrong. Please try again.', e_net: 'Connection problem. Please try again.',
  e_rate: 'Too many requests. Please wait a moment.', e_offline: 'You are offline. Check your internet connection.', e_server: 'The server is not responding right now.', retry: 'Try again', maint: 'Maintenance', maint_text: 'The app is being updated. You can look around; changes are paused for a short time.',
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
  have_code: 'Have a discount code?', apply: 'Apply', code_ok: '{p}% discount applied', welcome_disc: 'Welcome discount: {p}% off your first purchase', code_invalid: 'This code is not valid.', code_expired: 'This code has expired.', code_used_up: 'This code has been fully used.', code_not_for_plan: 'This code does not apply to this plan.', free_code: 'Activate free',
  invite: 'Invite friends', invite_sub: 'Share your link. Your friend gets {p}% off their first purchase, and you get {r} when they pay.', invite_days: '{n} free days', invite_credits: '{n} free credits', your_link: 'Your invite link', invited: 'Joined with your link', rewarded: 'Rewards earned', share_tg: 'Share on Telegram', share_wa: 'Share on WhatsApp', invite_msg: 'Try this app — use my link for a discount:',
  language: 'Language', lang_auto: 'Automatic — same as your Telegram', admin_settings: 'Admin settings', admin_sub: 'Prices, payments, health, codes', help_l: 'How it works', contact: 'Contact support', contact_sub: 'Questions, problems or ideas — we read every message.',
  t_question: 'Question', t_problem: 'Problem', t_payment: 'Payment', t_suggestion: 'Idea', write_here: 'Write your message…', send: 'Send', sent_ok: 'Sent. We will reply here and in the bot chat.', my_requests: 'My requests',
  st_open: 'Waiting for reply', st_answered: 'Answered', st_closed: 'Closed', you: 'You', team: 'Support', reply: 'Reply', no_requests: 'No requests yet.',
  rep_ready: 'Your report is ready', rep_making: 'Preparing your PDF…', rep_dl: 'Download PDF', rep_send: 'Send to my Telegram chat', rep_sent: 'Sent to your Telegram chat', rep_hint: 'If the download does not start inside Telegram, use “Send to my Telegram chat”.', rep_pro: 'PDF reports are part of Pro.', generated: 'Generated', page: 'Page'
},
so: {
  back: 'Dib', settings: 'Dejinta', save: 'Keydi', saved: 'Waa la keydiyay', cancel: 'Jooji', copied: 'Waa la koobiyeeyay', remove: 'Ka saar', edit: 'Wax ka beddel', add: 'Ku dar', done: 'Dhammaad', close: 'Xir', share: 'La wadaag', search: 'Raadi',
  q_saving: 'Waa la kaydinayaa {n}…', q_wait: '{n} waxay sugayaan xiriir', q_fail: 'Isbeddel lama kaydin karin. Fadlan hubi.',
  e_gen: 'Khalad ayaa dhacay. Fadlan isku day mar kale.', e_net: 'Dhibaato xiriir. Fadlan isku day mar kale.',
  e_rate: 'Codsiyo badan. Fadlan sug daqiiqad.', e_offline: 'Internet kuma xirnid. Hubi xiriirkaaga.', e_server: 'Server-ku hadda ma jawaabayo.', retry: 'Isku day mar kale', maint: 'Dayactir', maint_text: 'App-ka waa la cusboonaysiinayaa. Waad eegi kartaa; isbeddellada waa la hakiyay muddo gaaban.',
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
  have_code: 'Ma haysaa kood qiimo dhimis?', apply: 'Isticmaal', code_ok: '{p}% qiimo dhimis ayaa la dabaqay', welcome_disc: 'Qiimo dhimis soo dhaweyn: {p}% iibkaaga ugu horreeya', code_invalid: 'Koodkan sax ma aha.', code_expired: 'Koodkan wuu dhacay.', code_used_up: 'Koodkan waa la isticmaalay oo dhan.', code_not_for_plan: 'Koodkan kuma shaqeeyo qorshahan.', free_code: 'Ku hawlgeli bilaash',
  invite: 'Casuun saaxiibbo', invite_sub: 'La wadaag link-gaaga. Saaxiibkaa wuxuu helayaa {p}% qiimo dhimis iibkiisa ugu horreeya, adiguna waxaad helaysaa {r} marka uu bixiyo.', invite_days: '{n} maalmood oo bilaash ah', invite_credits: '{n} dhibcood oo bilaash ah', your_link: 'Link-gaaga casuumaadda', invited: 'Ku soo biiray link-gaaga', rewarded: 'Abaalmarinnada la helay', share_tg: 'Ku wadaag Telegram', share_wa: 'Ku wadaag WhatsApp', invite_msg: 'Isku day app-kan — isticmaal link-gayga si aad qiimo dhimis u hesho:',
  language: 'Luqadda', lang_auto: 'Toos — la mid ah Telegram-kaaga', admin_settings: 'Dejinta maamulka', admin_sub: 'Qiimaha, lacag-bixinta, caafimaadka, koodhadhka', help_l: 'Sida uu u shaqeeyo', contact: 'La xiriir taageerada', contact_sub: 'Su\'aalo, dhibaatooyin ama fikrado — fariin kasta waan akhrinnaa.',
  t_question: 'Su\'aal', t_problem: 'Dhibaato', t_payment: 'Lacag-bixin', t_suggestion: 'Fikrad', write_here: 'Halkan ku qor fariintaada…', send: 'Dir', sent_ok: 'Waa la diray. Waxaan kaaga jawaabi doonnaa halkan iyo sheekada bot-ka.', my_requests: 'Codsiyadayda',
  st_open: 'Sugaya jawaab', st_answered: 'La jawaabay', st_closed: 'Xiran', you: 'Adiga', team: 'Taageero', reply: 'Jawaab', no_requests: 'Weli codsi ma jiro.',
  rep_ready: 'Warbixintaadu waa diyaar', rep_making: 'PDF-ka ayaa la diyaarinayaa…', rep_dl: 'Soo deji PDF', rep_send: 'U dir sheekadayda Telegram', rep_sent: 'Waa loo diray sheekadaada Telegram', rep_hint: 'Haddii soo dejintu aysan ka bilaabmin Telegram, isticmaal “U dir sheekadayda Telegram”.', rep_pro: 'Warbixinnada PDF waxay ka mid yihiin Pro.', generated: 'La sameeyay', page: 'Bogga'
}};
var LANG, LANGS = { en: 'English', so: 'Soomaali' };
/* Language follows the user's Telegram (or browser) language automatically; anyone can override it in Settings.
   A language without translations falls back to English (add an entry to L and to LANGS to support it). */
function autoLang() { var c = ((TGU && TGU.language_code) || navigator.language || 'en').toLowerCase().slice(0, 2); if (EDITION === 'local' && !TGU) c = 'so'; return L[c] ? c : 'en'; }
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
      if (b.bars) {   // horizontal bars: {bars:{items:[[label, value, color]], fmt}}
        var it = b.bars.items || [], mx = it.reduce(function (a, x) { return Math.max(a, +x[1] || 0); }, 0) || 1, lw = 300, vw = 150, bw2 = W - 2 * M - lw - vw;
        it.forEach(function (row) { need(44); var w = Math.max(2, (+row[1] || 0) / mx * bw2);
          txt(fit(row[0], lw - 16, '400 21px ' + FONT), M, y + 27, '400 21px ' + FONT, '#344054'); var cx2 = c.getContext('2d'); cx2.fillStyle = row[2] || ACC; var bx = rtl ? W - M - lw - w : M + lw; cx2.fillRect(bx, y + 10, w, 22);
          txt((b.bars.fmt ? b.bars.fmt(row[1]) : row[1]), M + lw + w + 12, y + 28, '600 20px ' + FONT, '#101828'); y += 40; });
        y += 14;
      }
      if (b.stack) {   // vertical stacked columns: {stack:{labels:[...], series:[{name,color,values:[]}], fmt}}
        var S2 = b.stack, n = S2.labels.length, chH = 340, tot = S2.labels.map(function (_, i) { return S2.series.reduce(function (a, se) { return a + (+se.values[i] || 0); }, 0); }), mx2 = Math.max.apply(null, tot.concat([1]));
        need(chH + 120); var x0 = M + 70, cw = (W - 2 * M - 70) / n, base = y + chH, cx3 = c.getContext('2d');
        cx3.fillStyle = '#eaecf0'; [0, .5, 1].forEach(function (g) { cx3.fillRect(x0, base - g * chH, W - M - x0, 1); txt(S2.fmt ? S2.fmt(mx2 * g) : Math.round(mx2 * g), x0 - 10, base - g * chH + 6, '400 17px ' + FONT, '#98a2b3', 'right'); });
        S2.labels.forEach(function (lab, i) { var yy = base; S2.series.forEach(function (se) { var v = +se.values[i] || 0, hh = v / mx2 * chH; if (hh > 0) { cx3.fillStyle = se.color; cx3.fillRect(x0 + i * cw + cw * 0.18, yy - hh, cw * 0.64, Math.max(1, hh - 2)); } yy -= hh; });
          txt(lab, x0 + i * cw + cw / 2, base + 26, '400 16px ' + FONT, '#667085', 'center'); });
        y = base + 48; var lx = M; S2.series.forEach(function (se) { cx3.fillStyle = se.color; cx3.fillRect(lx, y, 16, 16); txt(se.name, lx + 24, y + 14, '400 18px ' + FONT, '#344054'); cx3.font = '400 18px ' + FONT; lx += 44 + cx3.measureText(se.name).width; if (lx > W - M - 160) { lx = M; y += 28; } });
        y += 44;
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
function revenueReport(r) {
  var usd = function (n) { return '$' + (+n || 0).toFixed(2); }, cm = r.months[r.months.length - 1], T = r.totals, all = r.scope === 'all';
  var mrows = r.months.slice().reverse();
  var blocks = [{ kpis: [['This month (USD)', usd(cm.usd), 'good'], ['This month (Stars)', cm.stars], ['12 months (USD)', usd(r.months.reduce(function (a, m) { return a + m.usd; }, 0))], ['12 months (Stars)', r.months.reduce(function (a, m) { return a + m.stars; }, 0)],
      ['Paid orders (all time)', T.orders], ['Users', T.users], ['Active subscriptions', T.activeSubs], ['Waiting review', T.pendingReview, T.pendingReview ? 'bad' : null]] },
    { h: 'By month' }, { table: { cols: [{ label: 'Month', w: 1.4 }, { label: 'Paid orders', w: 1.1, align: 'right' }, { label: 'USD (USDT + local)', w: 1.6, align: 'right' }, { label: 'Stars', w: 1.1, align: 'right' }, { label: 'New users', w: 1.1, align: 'right' }],
      rows: mrows.map(function (m) { return [m.month, m.orders, usd(m.usd), m.stars, m.newUsers]; }),
      total: ['12 months', mrows.reduce(function (a, m) { return a + m.orders; }, 0), usd(mrows.reduce(function (a, m) { return a + m.usd; }, 0)), mrows.reduce(function (a, m) { return a + m.stars; }, 0), mrows.reduce(function (a, m) { return a + m.newUsers; }, 0)] } }];
  if (all) blocks.push({ h: 'By app' }, { table: { cols: [{ label: 'App', w: 1.6 }, { label: 'Orders', w: 1, align: 'right' }, { label: 'USD', w: 1.2, align: 'right' }, { label: 'Stars', w: 1, align: 'right' }, { label: 'Users', w: 1, align: 'right' }, { label: 'Active subs', w: 1.1, align: 'right' }],
    rows: r.byApp.map(function (a) { return [a.app, a.orders, usd(a.usd), a.stars, a.users, a.activeSubs]; }) } });
  blocks.push({ h: 'By payment method' }, { table: { cols: [{ label: 'Method', w: 2 }, { label: 'Orders', w: 1, align: 'right' }, { label: 'USD', w: 1.3, align: 'right' }, { label: 'Stars', w: 1.1, align: 'right' }], empty: 'No paid orders yet.',
    rows: r.byMethod.map(function (m) { return [L.en[m.method] || m.method, m.orders, usd(m.usd), m.stars]; }) } },
    { h: 'By plan' }, { table: { cols: [{ label: 'Plan', w: 2.4 }, { label: 'Orders', w: 1, align: 'right' }, { label: 'USD', w: 1.3, align: 'right' }, { label: 'Stars', w: 1.1, align: 'right' }], empty: 'No paid orders yet.',
    rows: r.byPlan.map(function (m) { return [m.plan, m.orders, usd(m.usd), m.stars]; }) } },
    { text: 'USD = USDT and local mobile-money payments. Stars are shown separately; their value in USD depends on Telegram\'s payout rate at withdrawal time. ' + (all ? 'All-apps totals come from the central sheet (numbers from every app, refreshed hourly).' : '') });
  return { brand: 'Admin report', title: 'Revenue report', subtitle: (all ? 'All apps' : r.appName) + ' · last 12 months', blocks: blocks };
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
  return Object.assign({ x_refOn: true, x_refNewPct: 10, x_refDays: 7, x_refCredits: 0, appName: 'App', testMode: true, freeAllowance: 2, freeMaxMB: 10, paidMaxMB: 100, supportContact: '', localPrefixes: '252', plans: [],
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
  init: function (d, s) { var r = dRegion(s); return { ok: true, demo: true, verified: false, isAdmin: true, perms: ['super', 'support', 'payments', 'settings', 'reports'], user: { id: TGU ? TGU.id : 0, name: TGU ? TGU.first_name : 'Demo user' }, region: r, phoneVerified: !!s.phoneVerified,
    access: dAccess(s, d), plans: (s.settings.plans || []).filter(function (p) { return p.region === 'ALL' || p.region === r; }), methods: availMethods(s.settings, r), appName: s.settings.appName, support: s.settings.supportContact,
    ref: s.settings.x_refOn ? { on: true, arg: 'r' + (TGU ? TGU.id : '1000'), newPct: +s.settings.x_refNewPct || 0, days: +s.settings.x_refDays || 0, credits: +s.settings.x_refCredits || 0 } : { on: false },
    maintenance: s.settings.x_maintenance ? (s.settings.x_maintenanceMsg || true) : false, firstPct: /^r\d+/.test(START) && !s.orders.some(function (o) { return o.status === 'paid'; }) && s.settings.x_refOn ? +s.settings.x_refNewPct || 0 : 0 }; },
  checkCode: function (d, s) { var c = dCode(s, d.code, d.plan); return c.error ? { ok: false, error: c.error } : { ok: true, code: c.code, pct: c.pct }; },
  adminCodes: function (d, s) { return { ok: true, codes: (s.codes || []).filter(function (c) { return c.scope === 'all'; }) }; },
  adminCodeSave: function (d, s) { return dCodeSave(s, d, 'all'); },
  adminCodeToggle: function (d, s) { var c = (s.codes || []).filter(function (x) { return x.code === d.code; })[0]; if (c) c.active = !!d.active; return { ok: true }; },
  refStats: function (d, s) { return { ok: true, invited: 0, rewarded: 0, days: +s.settings.x_refDays || 0, credits: +s.settings.x_refCredits || 0, newPct: +s.settings.x_refNewPct || 0 }; },
  consume: function (d, s) { var a = dAccess(s, d); if (!a.entitled) return { ok: true, allowed: false, access: a }; if (a.reason === 'free') s.freeUsed++; else if (a.reason === 'credits') s.credits--; s.total++; return { ok: true, allowed: true, token: 'demo', access: dAccess(s, d) }; },
  createOrder: function (d, s) { var p = dPlan(s, d.plan); if (!p) return { ok: false, error: 'plan' };
    var dc = dCode(s, d.code, d.plan); if (dc.error) return { ok: false, error: dc.error };
    var fp = /^r\d+/.test(START) && !String(d.plan).match(/\|/) && !s.orders.some(function (o) { return o.status === 'paid'; }) && s.settings.x_refOn ? +s.settings.x_refNewPct || 0 : 0, pct = Math.max(dc.pct || 0, fp);
    p = Object.assign({}, p, { usd: Math.round(p.usd * (100 - pct)) / 100, stars: Math.ceil(p.stars * (100 - pct) / 100) });
    if (dc.pct) { var cr = (s.codes || []).filter(function (x) { return x.code === dc.code; })[0]; if (cr) cr.used++; }
    if (pct >= 100) { var fo = { order_id: 'D' + uid(), plan: d.plan, method: 'code', status: 'pending', amount: '$0.00', currency: 'USD', created: new Date().toISOString(), app: CFG.appId }; s.orders.push(fo); dMarkPaid(s, fo); return { ok: true, free: true, order_id: fo.order_id, status: 'paid' }; }
    var o = { order_id: 'D' + uid(), plan: d.plan, method: d.method, status: 'pending', created: new Date().toISOString(), app: CFG.appId };
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
  adminRevenue: function (d, s) {
    var now = new Date(), months = [], idx = {}, T = { orders: 0, usd: 0, stars: 0, users: 1, activeSubs: s.sub && new Date(s.sub.expiry) > now ? 1 : 0, pendingReview: 0 }, bm = {}, bp = {};
    for (var i = 11; i >= 0; i--) { var k = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7); idx[k] = months.length; months.push({ month: k, orders: 0, usd: 0, stars: 0, newUsers: k === now.toISOString().slice(0, 7) ? 1 : 0 }); }
    s.orders.forEach(function (o) { if (o.status === 'review') T.pendingReview++; if (o.status !== 'paid') return; var st = o.currency === 'XTR' ? +o.amount : 0, us = o.currency === 'XTR' ? 0 : parseFloat(String(o.amount).replace(/[^\d.]/g, '')) || 0, k = String(o.created || now.toISOString()).slice(0, 7);
      T.orders++; T.usd += us; T.stars += st; if (idx[k] !== undefined) { months[idx[k]].orders++; months[idx[k]].usd += us; months[idx[k]].stars += st; }
      [[bm, o.method, 'method'], [bp, o.plan, 'plan']].forEach(function (g) { var x = g[0][g[1]] || (g[0][g[1]] = { orders: 0, usd: 0, stars: 0 }); x[g[2]] = g[1]; x.orders++; x.usd += us; x.stars += st; }); });
    var vals = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
    return { ok: true, scope: d.scope === 'all' ? 'all' : CFG.appId, appName: s.settings.appName, months: months, byMethod: vals(bm), byPlan: vals(bp), totals: T,
      byApp: [{ app: CFG.appId, orders: T.orders, usd: T.usd, stars: T.stars, users: 1, activeSubs: T.activeSubs }] };
  },
  adminHealth: function (d, s) { var paid = s.orders.filter(function (o) { return o.status === 'paid'; }).length;
    return { ok: true, demo: true, totals: { requests: 40 + s.total * 3, errors: 0, errorRate: 0, p95: 1000, aiCalls: 0, aiTokens: 0 }, queue: { queued: 0, oldestMin: 0, failed24h: 0 },
      payments: { review: s.orders.filter(function (o) { return o.status === 'review'; }).length, usdtPending: 0 }, crons: { min5: new Date(Date.now() - 3e5).toISOString() }, lastBackup: new Date(Date.now() - 6 * 36e5).toISOString(),
      sheet: { cells: 1200 + paid * 14, pctOf10M: 0.01 }, webhook: { url: true, pending: 0, lastError: '' }, ai: { today: 0, budget: +s.settings.x_aiDailyBudget || 500 }, recentErrors: [], hours: [] }; },
  ticketCreate: function (d, s) { s.tickets = s.tickets || []; var id = 'T' + uid(); s.tickets.unshift({ id: id, type: d.type, status: 'open', updated: new Date().toISOString(), messages: [{ from: 'user', text: d.text, at: new Date().toISOString() }] });
    setTimeout(function () {}, 0); return { ok: true, id: id }; },
  ticketMine: function (d, s) { (s.tickets || []).forEach(function (x) { if (x.status === 'open' && !x.demoReplied && Date.now() - new Date(x.updated).getTime() > 4000) { x.demoReplied = true; x.status = 'answered'; x.messages.push({ from: 'admin', text: 'Thanks for your message! (Demo: in the live app the team replies from the Control Center.)', at: new Date().toISOString() }); } }); return { ok: true, items: s.tickets || [] }; },
  ticketReply: function (d, s) { var x = (s.tickets || []).filter(function (y) { return y.id === d.id; })[0]; if (x) { x.messages.push({ from: 'user', text: d.text, at: new Date().toISOString() }); x.status = 'open'; x.updated = new Date().toISOString(); } return { ok: true }; },
  adminAudit: function (d, s) { return { ok: true, items: (s.audit || []).slice().reverse() }; },
  adminResetMe: function (d, s) { s.freeUsed = 0; s.credits = 0; s.sub = null; s.phoneVerified = false; return { ok: true }; }
};
function dCode(s, code, planId) { code = String(code || '').trim().toUpperCase(); if (!code) return {};
  var c = (s.codes || []).filter(function (x) { return x.code === code; })[0], chKey = String(planId || '').indexOf('|') > 0 ? String(planId).split('|')[0] : '';
  if (!c || !c.active) return { error: 'code_invalid' }; if (c.expires && c.expires < new Date().toISOString().slice(0, 10)) return { error: 'code_expired' };
  if (c.max_uses && c.used >= c.max_uses) return { error: 'code_used_up' }; if (c.scope === 'all' ? !!chKey : c.scope !== 'ch:' + chKey) return { error: 'code_not_for_plan' };
  if (c.plans && planId && c.plans.split(',').map(function (x) { return x.trim(); }).indexOf(chKey ? String(planId).split('|')[1] : planId) < 0) return { error: 'code_not_for_plan' };
  return { code: c.code, pct: c.pct }; }
function dCodeSave(s, d, scope) { s.codes = s.codes || []; var code = String(d.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); if (code.length < 3 || code.length > 20) return { ok: false, error: 'code_format' };
  var pct = Math.round(+d.pct); if (!(pct >= 1 && pct <= 100)) return { ok: false, error: 'code_pct' }; var c = s.codes.filter(function (x) { return x.code === code; })[0];
  if (c && c.scope !== scope) return { ok: false, error: 'code_taken' }; if (!c) { c = { code: code, scope: scope, used: 0 }; s.codes.push(c); }
  Object.assign(c, { pct: pct, max_uses: +d.max_uses || 0, expires: d.expires || '', plans: d.plans || '', note: d.note || '', active: true }); return { ok: true }; }
function demoCall(action, d) {
  return new Promise(function (res) { setTimeout(function () { var s = dState(), r;
    if (/^(adminSave|adminSetSecret|adminDecide|adminCodeSave|adminCodeToggle|adminResetMe|adminMkWithdrawal|adminSchSave|adminSchDelete|gkMemberAction|gkBroadcast|gkSave|gkCodeSave|mkDecide)$/.test(action)) { s.audit = (s.audit || []).slice(-50); s.audit.push({ time: new Date().toISOString(), user: TGU ? TGU.id : 'demo', action: action, detail: d.code || d.op || d.order_id || d.key || '' }); }
    if (s.settings.x_maintenance && !/^admin/.test(action) && /^(consume|createOrder|submitManual|sendFile|sendReport)$|(Save|Add|Del|Delete|Submit|Reply|Publish|Checkin|Decide|Withdraw|Score|Translate|Toggle|Action|Broadcast|TestJoin|RefreshLink)/.test(action)) { r = { ok: false, error: 'maintenance', message: s.settings.x_maintenanceMsg || '' }; lsSet(DKEY(), s); if (S.me) S.me.maintenance = r.message || true; return res(r); }
    try { r = APP.demo[action] ? APP.demo[action](d, s) : DemoCore[action] ? DemoCore[action](d, s) : { ok: false, error: 'unknown_action' }; } catch (e) { console.error(e); r = { ok: false, error: e.message }; }
    lsSet(DKEY(), s); res(r); }, 150); });
}
/* Network calls: every call carries a request id (rid). The server stores the answer per rid, so a retry after a
   timeout never runs twice (no double charge). One automatic retry with jitter, except slow AI calls. */
var SLOW = /^(coScore|trTranslate|mkSubmit|sendFile|sendReport)$/;
function newRid() { try { if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 24); } catch (e) {} return Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
/* ---- Speed: stale-while-revalidate cache (same idea as the school app's apiCache) ----
   Reads: an answer younger than 60 s is reused; an older one (up to 24 h, kept on the phone) is shown instantly while
   a fresh copy loads in the background — the screen updates itself if anything changed.
   Writes (pay, save, send…): go straight to the server. Stored screens are NOT wiped (that made every next tab wait for
   Google); they are marked "check again": shown instantly and refreshed in the background. For 60 s after a save the
   background refresh asks for fresh:1, so the Cloudflare copy is bypassed and the screen shows the saved change.
   Learned prefetch: screens used recently are refreshed in the background when the app opens, so tabs open instantly.
   The server still checks every action, so stored data can never unlock anything. */
var WRITE_RE = /^(consume|createOrder|submitManual|sendFile|sendReport|ticketCreate|ticketReply|clientError)$|(Save|Add|Del|Delete|Submit|Reply|Publish|Checkin|Decide|Withdraw|Score|Translate|Toggle|Action|Broadcast|TestJoin|RefreshLink|Close|Remove|Draft|Ask)/;
var NOCACHE_RE = /^(checkOrder|checkCode|adminHealth|adminAudit)$/, FRESH_MS = 60000, KEEP_MS = 864e5;
var inflight = {}, revalidated = {}, memCache = {}, lsCacheKey = function () { return 'rc_' + CFG.appId + '_' + (TGU ? TGU.id : '0'); };
(function () { var st = lsGet(lsCacheKey(), {}); Object.keys(st || {}).forEach(function (k) { if (Date.now() - st[k].t < KEEP_MS) memCache[k] = st[k]; }); })();
function cacheSet(k, v) { memCache[k] = { t: Date.now(), v: v }; cachePersist(); }
function cachePersist() { var keep = {}, keys = Object.keys(memCache).sort(function (a, b) { return memCache[b].t - memCache[a].t; }).slice(0, 25);
  keys.forEach(function (x) { var js = JSON.stringify(memCache[x]); if (js.length < 100000) keep[x] = memCache[x]; }); lsSet(lsCacheKey(), keep); }
function cacheClear() { memCache = {}; lsSet(lsCacheKey(), {}); }
function cacheStale() { Object.keys(memCache).forEach(function (k) { memCache[k].stale = true; }); cachePersist(); }
var bypassUntil = 0, PF_KEY = function () { return 'pf_' + CFG.appId + '_' + (TGU ? TGU.id : '0'); };
function pfNote(action, data) {   // remember which screens this person uses (for the background refresh on open)
  if (/^(admin|cc)/.test(action)) return;
  var l = lsGet(PF_KEY(), []), k = action + '|' + JSON.stringify(data); if (!Array.isArray(l)) l = [];
  l = l.filter(function (x) { return x.k !== k; }); l.unshift({ k: k, a: action, d: data }); lsSet(PF_KEY(), l.slice(0, 12));
}
function prefetch() {   // after the first screen is shown: refresh recently used screens one by one, quietly
  if (DEMO) return; var l = lsGet(PF_KEY(), []); if (!Array.isArray(l)) return; var i = 0;
  (function next() { if (i >= l.length) return; var x = l[i++]; api(x.a, x.d, { quiet: true }).then(function () { setTimeout(next, 150); }, function () { setTimeout(next, 150); }); })();
}
function api(action, data, opts) {
  opts = opts || {}; var orig = data || {};
  data = Object.assign({}, orig); data.simulateFree = !!lsGet('simfree_' + CFG.appId, false);
  if (DEMO) return demoCall(action, data);
  if (WRITE_RE.test(action)) return callServer(action, data).then(function (res) { if (res && res.ok !== false) { cacheStale(); bypassUntil = Date.now() + 60000; } return res; });
  if (NOCACHE_RE.test(action)) return callServer(action, data);
  var k = action + '|' + JSON.stringify(data), hit = memCache[k], age = hit ? Date.now() - hit.t : Infinity, screenAt = S.screen;
  if (!opts.quiet) pfNote(action, orig);
  var mustCheck = !revalidated[k] || (hit && hit.stale); revalidated[k] = true;   // each app open (and after a save) every screen re-checks once in the background
  if (hit && age < FRESH_MS && !mustCheck) return Promise.resolve(hit.v);
  if (inflight[k]) return hit ? Promise.resolve(hit.v) : inflight[k];   // same request already on its way: never send it twice
  var bypass = Date.now() < bypassUntil;
  function load(fresh) {
    return callServer(action, fresh ? Object.assign({ fresh: 1 }, data) : data).then(function (res) {
      if (res && res.ok) {
        var cur = memCache[k], changed = !cur || JSON.stringify(cur.v) !== JSON.stringify(res); cacheSet(k, res);
        if (cur && changed && !opts.quiet) { if (action === 'init') { S.me = res; if (canAutoRefresh()) render(); } else if (S.screen === screenAt) scheduleRefresh(); }   // background refresh updates the screen
      }
      return res;
    });
  }
  var p = inflight[k] = load(bypass && !!hit).then(function (res) {
    delete inflight[k];
    if (bypass && !hit && res && res.ok) load(true);   // shown at once from the Cloudflare copy; just after a save, confirm it with a fresh read
    return res;
  });
  if (hit && age < KEEP_MS) return Promise.resolve(hit.v);   // instant answer from the phone, fresh one on its way
  return p;
}
/* Never redraw under the user's fingers: skip while typing or while a form/editor is open. */
function canAutoRefresh() { var ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
  return !document.querySelector('#app textarea, #app [data-set], #app [data-f], #app [data-tf], #app [data-sf], #app [data-pi], #app [data-plan-i], #app #eamt, #app #cname'); }
var refreshTimer = null;
function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { if (canAutoRefresh()) enter(); }, 120); }
function callServer(action, data) {
  if (navigator.onLine === false) return Promise.resolve({ ok: false, error: 'offline' });
  var passKey = 'pass_' + CFG.appId + '_' + (TGU ? TGU.id : '');   // signed pass for the Cloudflare edge copy (see shared/edge-proxy.js)
  var body = JSON.stringify(Object.assign({ action: action, app: CFG.appId, edition: EDITION, initData: IN_TG ? TG.initData : '', start: START, rid: newRid(), v: CFG.version, pass: TGU ? lsGet(passKey, '') : '' }, data));
  var slow = SLOW.test(action), tmo = slow ? 120000 : 25000;
  var tries = 0;
  function once() {   // 1st try: the edge copy (apiUrl); a retry goes straight to Apps Script (directUrl) when the edge fails
    var url = tries++ && CFG.directUrl ? CFG.directUrl : CFG.apiUrl;
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, tmo);
    return fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('http_' + r.status); return r.json(); }, function (e) { clearTimeout(timer); throw e; })
      .then(function (res) { if (res && res.error === 'not_configured' && CFG.directUrl && url !== CFG.directUrl) return once(); return res; });
  }
  var p = once();
  if (!slow) p = p.catch(function () { return new Promise(function (r) { setTimeout(r, 700 + Math.random() * 900); }).then(once); });
  return p.catch(function () { return { ok: false, error: navigator.onLine === false ? 'offline' : 'network' }; }).then(function (res) {
    if (res && res.edgePass && TGU) lsSet(passKey, res.edgePass);
    if (res && res.error === 'maintenance' && S.me) { S.me.maintenance = res.message || true; }
    if (res && res.error === 'rate_limited') toast(t('e_rate'));
    return res;
  });
}
/* Phone save queue: a save shows as done at once and is sent in the background, in order, surviving app restarts.
   Each item keeps its own request id (rid) and its own record id, so a retry can never create a duplicate. */
var QKEY = 'q_' + CFG.appId + '_' + (TGU ? TGU.id : '0'), qBusy = false, qTimer = null, qWait = 2000, qHandlers = {};
var Q_TRANSIENT = /^(network|offline|rate_limited|server_error|maintenance|not_configured|unauthorized)$/;
function qList() { var l = lsGet(QKEY, []); return Array.isArray(l) ? l : []; }
function queueSave(action, data) {
  if (DEMO) return api(action, data);
  var l = qList(); l.push({ action: action, data: Object.assign({}, data || {}, { rid: newRid() }), at: Date.now() }); lsSet(QKEY, l);
  qWait = 2000; qRun(); return Promise.resolve({ ok: true, queued: true });
}
function qRun() {
  if (qBusy || DEMO) return; clearTimeout(qTimer);
  var l = qList(); while (l.length && Date.now() - l[0].at > 7 * 864e5) { l.shift(); toast(t('q_fail')); } lsSet(QKEY, l);   // give up after 7 days
  qPaint(); if (!l.length) return;
  var it = l[0]; qBusy = true;
  callServer(it.action, it.data).then(function (res) {
    qBusy = false;
    if (!res || (res.ok === false && Q_TRANSIENT.test(res.error || ''))) { qTimer = setTimeout(qRun, qWait); qWait = Math.min(qWait * 2, 60000); qPaint(); return; }
    var l2 = qList(); if (l2.length && l2[0].data.rid === it.data.rid) l2.shift(); lsSet(QKEY, l2); qWait = 2000;
    if (res.ok !== false) { cacheStale(); bypassUntil = Date.now() + 60000; } else toast(t('q_fail'));
    var h = qHandlers[it.action]; if (h) try { h(res, it.data); } catch (e) {}
    if (!qList().length && canAutoRefresh()) enter();   // all saved: re-read the screen from the server
    qRun();
  });
}
function qPaint() {
  var n = qList().length, el = document.querySelector('.qpill');
  if (!n) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'qpill'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = t(navigator.onLine === false || qWait > 2000 ? 'q_wait' : 'q_saving', { n: n });
}
function onSaved(action, fn) { qHandlers[action] = fn; }
window.addEventListener('online', function () { qWait = 2000; qRun(); });
document.addEventListener('visibilitychange', function () { if (!document.hidden) qRun(); });

/* Report unexpected front-end errors (max 5 per session) so problems show up in the admin health panel. */
var errCount = 0;
function reportError(msg, where) { if (DEMO || !CFG.apiUrl || errCount++ >= 5) return; try { api('clientError', { msg: String(msg).slice(0, 300), where: S.screen + ' ' + (where || '') }); } catch (e) {} }
window.addEventListener('error', function (e) { reportError(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno); });
window.addEventListener('unhandledrejection', function (e) { reportError(e.reason && (e.reason.message || e.reason), 'promise'); });
window.addEventListener('online', function () { if (S.me && S.me.error) refreshMe().then(enter); });
function refreshMe() { return api('init').then(function (r) { if (r.ok) S.me = r; else if (!S.me || S.me.error) S.me = { access: computeAccess(defaultSettings(), null, 0, false, 0), plans: [], methods: [], error: r.error }; return S.me; }); }

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
    (window.APP_ABOUT && APP_ABOUT.title && !S.stack.length ? '<button class="ibtn" data-act="help" aria-label="Help">' + ic('info') + '</button>' : '') +
    (!S.stack.length ? '<button class="ibtn" data-act="prefs" aria-label="' + t('settings') + '">' + ic('settings') + '</button>' : '') + '</div>';
}
function banners() { var h = '', A = window.APP_ABOUT;
  if (A && A.intro && S.screen === 'home' && !lsGet('intro_' + CFG.appId, false)) h += '<div class="card intro"><div class="row" style="align-items:flex-start;gap:12px"><div class="ii">' + ic('info') + '</div><div class="grow"><b>' + esc(A.title) + '</b><p class="m" style="margin-top:4px">' + esc(A.intro) + '</p>' +
    '<ol class="steps" style="margin-top:8px">' + (A.steps || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div><div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn sm ghost" data-act="help">Learn more</button><button class="btn sm" data-act="introok">Got it</button></div></div>'; if (DEMO) h += '<div class="banner">' + ic('info', 's') + '<span>' + t('demo_banner') + '</span></div>';
  if (S.me && S.me.error) h += '<div class="banner bad">' + ic('alert', 's') + '<span class="grow">' + t(S.me.error === 'offline' ? 'e_offline' : 'e_server') + '</span><button class="btn sm" data-act="retryinit">' + t('retry') + '</button></div>';
  if (S.me && S.me.maintenance) h += '<div class="banner warn">' + ic('clock', 's') + '<span><b>' + t('maint') + '.</b> ' + esc(typeof S.me.maintenance === 'string' ? S.me.maintenance : t('maint_text')) + '</span></div>';
  if (S.me && S.me.access && S.me.access.reason === 'test') h += '<div class="banner">' + ic('shield', 's') + '<span>' + t('test_banner') + '</span></div>';
  if (lsGet('simfree_' + CFG.appId, false)) h += '<div class="banner">' + ic('user', 's') + '<span>' + t('sim_banner') + '</span></div>'; return h; }
function planChip() { var a = S.me && S.me.access; if (!a) return '';
  if (a.reason === 'test') return '<button class="chip" data-act="account">' + ic('shield', 's') + t('p_test') + '</button>';
  if (a.reason === 'sub') return '<button class="chip good" data-act="account">' + ic('check', 's') + t('p_pro') + '</button>';
  if (a.reason === 'credits') return '<button class="chip good" data-act="account">' + ic('star', 's') + t('p_credits', { n: a.credits }) + '</button>';
  if (a.reason === 'free') return '<button class="chip" data-act="account">' + ic('clock', 's') + t('p_free', { n: a.freeLeft }) + '</button>';
  return '<button class="chip warn" data-act="account">' + ic('lock', 's') + t('p_none') + '</button>'; }
function spin() { var line = function (w, h, m) { return '<div class="sk" style="height:' + (h || 14) + 'px;width:' + w + '%;margin-top:' + (m || 10) + 'px"></div>'; };
  return '<div class="card" aria-busy="true">' + line(55, 18, 0) + line(90) + line(70) + '</div><div class="card">' + line(40, 16, 0) + line(85) + '</div>'; }
function insight(icon, text, btn, act, tone) { return '<div class="insight ' + (tone || '') + '"><div class="ii">' + ic(icon) + '</div><div class="grow">' + text + '</div>' + (btn ? '<button class="btn sm" data-a="' + act + '">' + esc(btn) + '</button>' : '') + '</div>'; }
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
function paywall(ctx) { S.pw = ctx || {}; S.payPlan = null; S.disc = null; go('paywall'); }
function discPct() { return Math.max(S.disc ? S.disc.pct : 0, S.pw && S.pw.noRef ? 0 : (S.me && S.me.firstPct) || 0); }
function planPrice(p) { var d = discPct(), u = Math.round((+p.usd || 0) * (100 - d)) / 100, st = Math.ceil((+p.stars || 0) * (100 - d) / 100);
  if (!d) return '<div class="price">' + (p.usd ? '$' + (+p.usd).toFixed(2) : '') + (p.stars ? '<small>' + p.stars + ' Stars</small>' : '') + '</div>';
  return '<div class="price">' + (p.usd ? '<s style="color:var(--hint);font-weight:400;font-size:12px">$' + (+p.usd).toFixed(2) + '</s> $' + u.toFixed(2) : '') + (p.stars ? '<small>' + st + ' Stars</small>' : '') + '</div>'; }
function planSub(p) { return +p.days > 0 ? t('days', { n: p.days }) : +p.credits === 1 ? t('credit1') : +p.credits > 1 ? t('credits', { n: p.credits }) : ''; }
var BUILTIN = {
  paywall: function () {
    var me = S.me, pw = S.pw || {}, plans = pw.plans || me.plans, h = header(pw.title || t('pw_title'), '');
    if (!S.payPlan && plans[0]) S.payPlan = plans[0].id;
    h += '<div class="card"><div class="big">' + ic(pw.icon || 'lock', 'l') + '</div><h2 class="center">' + esc(pw.title || t('pw_title')) + '</h2><p class="m center">' + esc(pw.text || t('pw_text')) + '</p>' +
      '<ul class="feat">' + (pw.features || [t('f_unl'), t('f_all')]).map(function (f) { return '<li>' + ic('check') + esc(f) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="sec">' + t('choose_plan') + '</div><div class="opt">' + plans.map(function (p) { return '<div class="radio ' + (S.payPlan === p.id ? 'on' : '') + '" data-plan="' + esc(p.id) + '"><span class="dot"></span><div><b>' + esc(p.label) + '</b><div class="fs">' + planSub(p) + '</div></div>' + planPrice(p) + '</div>'; }).join('') + '</div>';
    var dp = discPct();
    h += '<div class="card" style="margin-top:10px">' + (me.firstPct && !(S.pw && S.pw.noRef) && (!S.disc || S.disc.pct < me.firstPct) ? '<div class="okmsg" style="margin:0 0 8px">' + ic('star', 's') + t('welcome_disc', { p: me.firstPct }) + '</div>' : '') +
      '<label class="f" style="margin-top:0">' + t('have_code') + '</label><div class="row"><input class="t" id="dcode" autocomplete="off" style="text-transform:uppercase" value="' + esc(S.disc ? S.disc.code : '') + '"><button class="btn sm sec2" data-act="applycode">' + t('apply') + '</button></div>' +
      (S.disc ? '<div class="okmsg">' + ic('check', 's') + t('code_ok', { p: S.disc.pct }) + '</div>' : '') + (S.codeErr ? '<div class="err">' + ic('alert', 's') + '<span>' + esc(S.codeErr) + '</span></div>' : '') + '</div>';
    if (dp >= 100) return h + '<button class="btn" data-act="freecode">' + ic('check') + t('free_code') + '</button>' + errBox();
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
    if (me.ref && me.ref.on) h += '<button class="btn sec2" data-act="invite">' + ic('users') + t('invite') + '</button>';
    return h;
  },
  prefs: function () {
    var me = S.me || {}, pref = lsGet('lang_' + CFG.appId, 'auto'), h = header(t('settings'), '');
    h += '<div class="sec">' + t('language') + '</div><div class="opt">' + [['auto', t('lang_auto') + ' (' + LANGS[autoLang()] + ')'], ['en', 'English'], ['so', 'Soomaali']].map(function (o) {
      return '<div class="radio ' + (pref === o[0] ? 'on' : '') + '" data-act="setlang" data-v="' + o[0] + '"><span class="dot"></span><b>' + esc(o[1]) + '</b></div>'; }).join('') + '</div>';
    h += '<div class="sec">' + t('support') + '</div><button class="chrow" data-act="help"><div class="av">' + ic('info') + '</div><div class="grow"><div class="fn">' + t('help_l') + '</div></div></button>' +
      '<button class="chrow" data-act="support"><div class="av">' + ic('message') + '</div><div class="grow"><div class="fn">' + t('contact') + '</div><div class="fs">' + t('contact_sub') + '</div></div></button>';
    if (me.plans && me.plans.length) h += '<button class="chrow" data-act="account"><div class="av">' + ic('star') + '</div><div class="grow"><div class="fn">' + t('my_plan') + '</div></div></button>';
    if (me.ref && me.ref.on) h += '<button class="chrow" data-act="invite"><div class="av">' + ic('users') + '</div><div class="grow"><div class="fn">' + t('invite') + '</div></div></button>';
    if (me.isAdmin) h += '<div class="sec">Admin</div><button class="chrow" data-act="settings"><div class="av">' + ic('settings') + '</div><div class="grow"><div class="fn">' + t('admin_settings') + '</div><div class="fs">' + t('admin_sub') + '</div></div></button>';
    return h + '<div class="foot">v' + esc(CFG.version) + '</div>';
  },
  support: function () {
    var h = header(t('contact'), ''), tk = S.tickets;
    h += '<div class="card"><p class="m" style="margin-bottom:10px">' + t('contact_sub') + '</p>' + seg('tktype', S.tkType || 'question', [['question', t('t_question')], ['problem', t('t_problem')], ['payment', t('t_payment')], ['suggestion', t('t_suggestion')]]) +
      '<textarea class="t" id="tktext" style="margin-top:10px;min-height:110px" maxlength="2000" placeholder="' + esc(t('write_here')) + '"></textarea><button class="btn" style="margin-top:10px" data-act="tksend">' + ic('send') + t('send') + '</button></div>' + errBox();
    h += '<div class="sec">' + t('my_requests') + '</div>';
    if (!tk) return h + spin();
    if (!tk.length) return h + '<div class="card"><p class="m">' + t('no_requests') + '</p></div>';
    return h + tk.map(function (x) { return '<div class="card"><div class="row"><span class="pill ' + (x.status === 'answered' ? 'ok' : x.status === 'closed' ? '' : 'ac') + '">' + t('st_' + x.status) + '</span><span class="grow"></span><span class="fs">' + esc(fmtDate(x.updated)) + '</span></div>' +
      (x.messages || []).map(function (m) { return '<div class="bub ' + (m.from === 'admin' ? 'them' : 'me') + '"><div class="fs">' + (m.from === 'admin' ? t('team') : t('you')) + '</div>' + esc(m.text) + '</div>'; }).join('') +
      (x.status !== 'closed' ? '<div class="row" style="margin-top:8px"><input class="t" id="tkr_' + esc(x.id) + '" placeholder="' + esc(t('reply')) + '…"><button class="btn sm sec2" data-act="tkreply" data-id="' + esc(x.id) + '">' + t('send') + '</button></div>' : '') + '</div>'; }).join('');
  },
  help: function () {
    var A = window.APP_ABOUT || {}, h = header('How it works', A.title || '');
    h += '<div class="card"><p class="m" style="color:var(--text)">' + esc(A.intro || '') + '</p><ol class="steps" style="margin-top:10px">' + (A.steps || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>';
    if (A.faq && A.faq.length) h += '<div class="sec">Questions</div>' + A.faq.map(function (q) { return '<details class="card faq"><summary><b>' + esc(q[0]) + '</b></summary><p class="m" style="margin-top:8px">' + esc(q[1]) + '</p></details>'; }).join('');
    if (S.me && S.me.support) h += '<div class="card">' + kv(t('support'), S.me.support, true) + '</div>';
    h += '<button class="btn" data-act="support">' + ic('message') + t('contact') + '</button>';
    if (S.me && S.me.ref && S.me.ref.on) h += '<button class="btn sec2" data-act="invite">' + ic('users') + t('invite') + '</button>';
    return h;
  },
  invite: function () {
    var me = S.me, r = S.refStats, h = header(t('invite'), ''); if (!r) return h + spin();
    var link = appLink(me.ref.arg), rew = [r.days ? t('invite_days', { n: r.days }) : '', r.credits ? t('invite_credits', { n: r.credits }) : ''].filter(Boolean).join(' + ') || '—';
    h += '<div class="card center"><div class="big">' + ic('users', 'l') + '</div><p class="m">' + t('invite_sub', { p: r.newPct, r: rew }) + '</p></div>';
    h += '<div class="card">' + kv(t('your_link'), link, true) + '<div class="g2" style="margin-top:6px"><button class="btn sm" data-act="sharetg">' + ic('send', 's') + t('share_tg') + '</button><button class="btn sm sec2" data-act="sharewa">' + ic('message', 's') + t('share_wa') + '</button></div></div>';
    h += '<div class="card stat"><div><b>' + r.invited + '</b><span>' + t('invited') + '</span></div><div><b>' + r.rewarded + '</b><span>' + t('rewarded') + '</span></div></div>';
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
  S.codeErr = '';
  api('createOrder', { plan: S.payPlan, method: method, code: S.disc ? S.disc.code : '' }).then(function (r) {
    if (r.ok && r.free) { S.payment = r; return onPaid(r); }
    if (!r.ok) { if (/^code_/.test(r.error)) { S.disc = null; S.codeErr = t(r.error); return render(); } if (r.error === 'phone_required') { S.payment = { method: method, phoneNeeded: true }; return go('pay'); } S.err = r.error === 'network' ? t('e_net') : t('e_gen'); return render(); }
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
function loadAdmin() { S.admin = null; render(); Promise.all([api('adminGet'), api('adminPending'), api('adminStats'), APP.adminLoad ? APP.adminLoad() : Promise.resolve(null), api('adminRevenue'), api('adminCodes'), api('adminHealth'), api('adminAudit')]).then(function (r) {
  S.admin = { settings: r[0].settings || defaultSettings(), secrets: r[0].secrets || {}, pending: r[1].items || [], stats: (r[2] && r[2].stats) || {}, extra: r[3], rev: r[4] && r[4].ok ? r[4] : null, codes: (r[5] && r[5].codes) || [], health: r[6] && r[6].ok ? r[6] : null, audit: (r[7] && r[7].items) || [] }; if (!r[0].ok) toast(r[0].error || 'error'); render(); }); }
function capi() { return APP.codeApi && S.screen !== 'settings' ? APP.codeApi : null; }
function reloadCodes() { var a = capi(); api(a ? a.list : 'adminCodes', a ? a.extra() : {}).then(function (r) { if (a) a.set(r.codes || []); else if (S.admin) S.admin.codes = r.codes || []; render(); }); }
/* Discount-code manager (used in admin Settings, and by Channel Pass creators for their own channel) */
function codesBlock(codes, hintPlans) {
  var h = '<div class="card">' + (codes.length ? '<ul class="files">' + codes.map(function (c) { return '<li><div class="grow"><div class="fn">' + esc(c.code) + ' · ' + c.pct + '%</div><div class="fs">Used ' + c.used + (c.max_uses ? ' / ' + c.max_uses : '') + (c.expires ? ' · until ' + esc(c.expires) : '') + (c.plans ? ' · ' + esc(c.plans) : '') + (c.note ? ' · ' + esc(c.note) : '') + '</div></div>' +
    '<button class="tgl ' + (c.active ? 'on' : '') + '" data-act="codetgl" data-code="' + esc(c.code) + '" data-on="' + (c.active ? 1 : 0) + '"></button></li>'; }).join('') + '</ul>' : '<p class="m">No codes yet.</p>') + '</div>';
  h += '<div class="card"><b style="font-size:14px">New code</b><div class="g2"><div><label class="f">Code</label><input class="t" id="nc_code" placeholder="SOMALI50" style="text-transform:uppercase"></div><div><label class="f">Discount %</label><input class="t" id="nc_pct" type="number" min="1" max="100" placeholder="20"></div>' +
    '<div><label class="f">Max uses (0 = unlimited)</label><input class="t" id="nc_max" type="number" min="0" placeholder="100"></div><div><label class="f">Expires (optional)</label><input class="t" id="nc_exp" type="date"></div></div>' +
    '<label class="f">Only for plan IDs (optional, comma separated)</label><input class="t" id="nc_plans" placeholder="' + esc(hintPlans || '') + '"><label class="f">Note (optional)</label><input class="t" id="nc_note" placeholder="e.g. influencer Hodan">' +
    '<div class="fs" style="margin-top:6px">100% = free access (good for partners and testers).</div><button class="btn sm" style="width:100%;margin-top:10px" data-act="codeadd">' + ic('plus', 's') + 'Save code</button></div>';
  return h;
}
/* System health: the few signals that predict user pain (book: SLOs, queue age, backups, evidence over intuition). */
function ago(isoStr) { if (!isoStr) return { txt: 'never', min: 1e9 }; var m = Math.round((Date.now() - new Date(isoStr).getTime()) / 6e4); return { txt: m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago', min: m }; }
function healthBlock(H) {
  var T = H.totals, q = H.queue, bk = ago(H.lastBackup), cr = ago(H.crons && H.crons.min5), wh = H.webhook, tiles = [], bad = 0, warn = 0;
  function tile(label, val, tone, hint) { if (tone === 'bad') bad++; else if (tone === 'warn') warn++; tiles.push('<div class="ht ' + (tone || 'good') + '"><span class="dot"></span><b>' + esc(val) + '</b><span>' + esc(label) + '</span>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</div>'); }
  tile('Requests (24 h)', T.requests, null);
  tile('Error rate', T.errorRate + '%', T.errorRate > 5 ? 'bad' : T.errorRate > 2 ? 'warn' : null, 'target under 2%');
  tile('Slow responses (p95)', T.p95 ? (T.p95 >= 15000 ? '>8 s' : '<' + (T.p95 / 1000) + ' s') : '—', T.p95 > 8000 ? 'bad' : T.p95 > 3000 ? 'warn' : null, 'target under 3 s');
  tile('Message queue', q.queued + (q.queued ? ' · oldest ' + q.oldestMin + ' min' : ''), q.oldestMin > 60 ? 'bad' : q.oldestMin > 20 ? 'warn' : null, q.failed24h ? q.failed24h + ' failed (24 h)' : '');
  tile('Payments to review', H.payments.review, H.payments.review > 0 ? 'warn' : null, H.payments.usdtPending ? H.payments.usdtPending + ' USDT waiting' : '');
  tile('Last backup', bk.txt, bk.min > 2160 ? 'bad' : null, 'daily, 14 kept');
  tile('Background jobs', cr.txt, cr.min > 30 ? 'bad' : null, 'runs every 5 min');
  if (wh) tile('Telegram webhook', wh.pending + ' pending', !wh.url ? 'bad' : (wh.lastError && Date.now() - new Date(wh.lastErrorAt).getTime() < 864e5) ? 'warn' : null, wh.url ? (wh.lastError ? 'last error: ' + wh.lastError.slice(0, 40) : 'connected') : 'not connected');
  tile('Sheet capacity', H.sheet.pctOf10M + '%', H.sheet.pctOf10M > 80 ? 'bad' : H.sheet.pctOf10M > 50 ? 'warn' : null, 'of 10M cells');
  if (Object.keys(APP.extraSecrets).some(function (k) { return /GEMINI/.test(k); })) tile('AI calls today', H.ai.today + ' / ' + H.ai.budget, H.ai.today >= H.ai.budget ? 'bad' : H.ai.today > H.ai.budget * 0.8 ? 'warn' : null, T.aiTokens ? T.aiTokens + ' tokens (24 h)' : '');
  var status = bad ? ['bad', 'Needs attention'] : warn ? ['warn', 'Check soon'] : ['good', 'All systems healthy'];
  return '<div class="sec">System health</div><div class="card"><div class="row" style="margin-bottom:10px"><span class="pill ' + (status[0] === 'good' ? 'ok' : status[0] === 'bad' ? 'bad' : 'ac') + '">' + ic(status[0] === 'good' ? 'check' : 'alert', 's') + status[1] + '</span><span class="grow"></span><button class="btn sm ghost" data-act="settings">' + ic('refresh', 's') + '</button></div>' +
    '<div class="hgrid">' + tiles.join('') + '</div>' + (H.recentErrors && H.recentErrors.length ? '<details style="margin-top:10px"><summary class="fs">Recent errors (' + H.recentErrors.length + ')</summary><ul class="files">' + H.recentErrors.map(function (e) { return '<li><div class="grow"><div class="fs"><b>' + esc(e.event) + '</b> · ' + esc(String(e.time).slice(11, 16)) + '</div><div class="fs">' + esc(e.detail) + '</div></div></li>'; }).join('') + '</ul></details>' : '') + '</div>';
}
function renderSettings() {
  var A = S.admin, h = header('Settings', 'Admin only'); if (!A) return h + spin();
  var st = A.settings, m = st.methods, showPlans = APP.showPlans !== false;
  function inp(id, v, ph, ty) { return '<input class="t" data-set="' + id + '" type="' + (ty || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '">'; }
  function sw(id, on, l, s) { return '<div class="sw"><div><b style="font-size:14px">' + l + '</b>' + (s ? '<div class="fs">' + s + '</div>' : '') + '</div><button class="tgl ' + (on ? 'on' : '') + '" data-toggle="' + id + '"></button></div>'; }
  if (DEMO) h += '<div class="banner">' + ic('info', 's') + '<span>Demo mode: settings are saved on this device only. Put the Apps Script URL in config.js → apiUrl to go live.</span></div>';
  if (!DEMO && !S.me.verified) h += '<div class="banner">' + ic('alert', 's') + '<span>Server cannot verify Telegram yet. Add BOT_TOKEN_' + esc(CFG.appId) + ' and ADMIN_IDS in Script properties.</span></div>';
  if (A.health) h += healthBlock(A.health);
  h += '<div class="sec">General</div><div class="card">' + sw('x:x_maintenance', st.x_maintenance, 'Maintenance mode', 'Read-only for users with a clear message. Payments already started still complete. One tap to undo.') +
    (st.x_maintenance ? '<label class="f">Message to users (optional)</label>' + inp('x_maintenanceMsg', st.x_maintenanceMsg || '', 'Back at 6 pm') : '') + sw('testMode', st.testMode, 'Test mode', 'Everyone gets full access. Turn OFF at launch.') +
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
  h += '<div class="sec">Referral program</div><div class="card">' + sw('x:x_refOn', st.x_refOn, 'Referral links on', 'Every user gets an invite link in the app.') +
    '<div class="g3"><div><label class="f">Friend discount %</label>' + inp('x_refNewPct', st.x_refNewPct, '10', 'number') + '</div><div><label class="f">Reward days</label>' + inp('x_refDays', st.x_refDays, '7', 'number') + '</div><div><label class="f">Reward credits</label>' + inp('x_refCredits', st.x_refCredits, '0', 'number') + '</div></div>' +
    '<div class="fs" style="margin-top:6px">The friend gets the discount on their first purchase. The inviter gets the reward when that friend pays. Save settings to apply.</div></div>';
  h += '<div class="sec">Discount codes (for your clients)</div>' + codesBlock(A.codes || [], (st.plans || []).map(function (p) { return p.id; }).join(', '));
  if (A.rev) { var cm = A.rev.months[A.rev.months.length - 1], pm = A.rev.months[A.rev.months.length - 2];
    h += '<div class="sec">Revenue</div><div class="card"><div class="stat"><div><b>$' + cm.usd.toFixed(2) + '</b><span>This month · USD</span></div><div><b>' + cm.stars + '</b><span>This month · Stars</span></div>' +
      '<div><b>' + cm.orders + '</b><span>Paid orders this month</span></div><div><b>$' + pm.usd.toFixed(2) + ' · ' + pm.stars + '★</b><span>Last month</span></div></div>' +
      '<button class="btn sm" style="width:100%;margin-top:10px" data-act="revpdf" data-scope="app">' + ic('chart', 's') + 'Revenue report PDF — this app</button>' +
      '<button class="btn sm sec2" style="width:100%;margin-top:8px" data-act="revpdf" data-scope="all">' + ic('chart', 's') + 'Revenue report PDF — all apps (shared ledger)</button></div>'; }
  if (APP.adminExtra) h += APP.adminExtra(A.extra);
  if (A.audit) h += '<div class="sec">Audit log (who changed what)</div><div class="card">' + (A.audit.length ? '<ul class="files">' + A.audit.slice(0, 25).map(function (a) { return '<li><div class="grow"><div class="fn">' + esc(a.action) + '</div><div class="fs">' + esc(String(a.time).replace('T', ' ').slice(0, 16)) + ' · user ' + esc(a.user) + ' · ' + esc(String(a.detail).slice(0, 90)) + '</div></div></li>'; }).join('') + '</ul>' : '<p class="m">No admin actions yet.</p>') + '</div>';
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
  if (d.seg === 'tktype') { var keep = (document.getElementById('tktext') || {}).value; S.tkType = d.val; render(); var ta = document.getElementById('tktext'); if (ta) ta.value = keep || ''; return; }
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
    case 'applycode': var cv = (document.getElementById('dcode') || {}).value || ''; cv = cv.trim().toUpperCase(); S.codeErr = '';
      if (!cv) { S.disc = null; return render(); }
      api('checkCode', { code: cv, plan: S.payPlan }).then(function (r) { if (r.ok) { S.disc = { code: r.code, pct: r.pct }; haptic('ok'); } else { S.disc = null; S.codeErr = t(r.error || 'code_invalid'); } render(); }); return;
    case 'freecode': startPayment('code'); return;
    case 'invite': S.refStats = null; go('invite'); api('refStats').then(function (r) { S.refStats = r.ok ? r : { invited: 0, rewarded: 0, days: 0, credits: 0, newPct: 0 }; render(); }); return;
    case 'sharetg': shareTg(appLink(S.me.ref.arg), t('invite_msg')); return;
    case 'sharewa': openLink('https://wa.me/?text=' + encodeURIComponent(t('invite_msg') + ' ' + appLink(S.me.ref.arg))); return;
    case 'codeadd': var f = { code: (document.getElementById('nc_code').value || '').trim().toUpperCase(), pct: +document.getElementById('nc_pct').value, max_uses: +document.getElementById('nc_max').value || 0,
        expires: document.getElementById('nc_exp').value, plans: document.getElementById('nc_plans').value.trim(), note: document.getElementById('nc_note').value.trim() };
      api(capi() ? capi().save : 'adminCodeSave', Object.assign(capi() ? capi().extra() : {}, f)).then(function (r) { if (r.ok) { toast('Saved'); reloadCodes(); } else toast(r.error === 'code_format' ? 'Code: 3–20 letters/numbers' : r.error === 'code_pct' ? 'Discount: 1–100%' : r.error === 'code_taken' ? 'Code already used elsewhere' : 'Error'); }); return;
    case 'codetgl': api(capi() ? capi().toggle : 'adminCodeToggle', Object.assign(capi() ? capi().extra() : {}, { code: el.dataset.code, active: el.dataset.on !== '1' })).then(function () { reloadCodes(); }); return;
    case 'revpdf': var scope = el.dataset.scope;
      showReport(function () { return api('adminRevenue', { scope: scope }).then(revenueReport); }, 'revenue-' + (scope === 'all' ? 'all-apps' : CFG.appId) + '-' + new Date().toISOString().slice(0, 7) + '.pdf'); return;
    case 'help': return go('help');
    case 'prefs': return go('prefs');
    case 'setlang': lsSet('lang_' + CFG.appId, el.dataset.v); LANG = el.dataset.v === 'auto' ? autoLang() : el.dataset.v; document.documentElement.lang = LANG; return render();
    case 'support': S.tickets = null; go('support'); api('ticketMine').then(function (r) { S.tickets = r.ok ? r.items : []; render(); }); return;
    case 'tksend': var tx = (document.getElementById('tktext') || {}).value || ''; if (tx.trim().length < 3) return;
      api('ticketCreate', { type: S.tkType || 'question', text: tx.trim() }).then(function (r) { if (r.ok) { S.msg = t('sent_ok'); S.err = ''; haptic('ok'); api('ticketMine').then(function (x) { S.tickets = x.items || []; render(); }); } else { S.err = r.error === 'rate_limited' ? t('e_rate') : t('e_gen'); render(); } }); return;
    case 'tkreply': var inp2 = document.getElementById('tkr_' + el.dataset.id); if (!inp2 || !inp2.value.trim()) return;
      api('ticketReply', { id: el.dataset.id, text: inp2.value.trim() }).then(function () { api('ticketMine').then(function (x) { S.tickets = x.items || []; render(); }); }); return;
    case 'introok': lsSet('intro_' + CFG.appId, true); return render();
    case 'retryinit': S.me = null; render(); refreshMe().then(enter); return;
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
  var pref = lsGet('lang_' + CFG.appId, 'auto'); LANG = pref === 'auto' || !L[pref] ? autoLang() : pref;
  document.documentElement.lang = LANG;
  $app = document.getElementById('app');
  if (IN_TG) { TG.BackButton.onClick(back); try { TG.ready(); TG.expand(); if (TG.isVersionAtLeast('7.7')) TG.disableVerticalSwipes(); } catch (e) {} }
  if (def.startScreen) S.screen = def.startScreen();
  render();
  try { var f0 = APP.enter[S.screen]; if (f0 && !DEMO) f0(); } catch (e) {}   // start the screen's data request now, in parallel with init
  refreshMe().then(function () { enter(); qRun(); setTimeout(prefetch, 1200); });   // then send saves left from last time, then refresh recently used screens
}

return { app: app, insight: insight, codesBlock: codesBlock, dCode: dCode, dCodeSave: dCodeSave, reloadCodes: reloadCodes, report: report, showReport: showReport, saveBlob: saveBlob, loadScript: loadScript, isPro: function () { return S.me && /^(sub|test)$/.test(S.me.access.reason); }, CFG: CFG, TG: TG, IN_TG: IN_TG, TGU: TGU, QS: QS, START: START, EDITION: EDITION, DEMO: DEMO, MB: MB, S: S,
  t: t, esc: esc, ic: ic, fmtDate: fmtDate, money: money, uid: uid, toast: toast, copy: copy, openLink: openLink, shareTg: shareTg, haptic: haptic, appLink: appLink, param: param, fileB64: fileB64,
  lsGet: lsGet, lsSet: lsSet, api: api, queueSave: queueSave, onSaved: onSaved, pending: function () { return qList(); }, refreshMe: refreshMe, go: go, back: back, home: home, render: render, header: header, banners: banners, planChip: planChip, spin: spin, errBox: errBox, empty: empty, kv: kv, seg: seg,
  paywall: paywall, needAccess: needAccess, consume: consume, lang: function () { return LANG; } };
})();
