/* Document Translator on Cloudflare D1 — the D1 twin of apps/translator/apps-script/Translator.gs.
 * Up to 3 photos per document; Gemini reads and translates in one call; the PDF is built on the phone.
 * Charged only when the translation succeeds. Images are NOT stored — only a short history row. */
const LANG = { en: 'English', ar: 'Arabic', so: 'Somali' }, NAME = { en: 'English', ar: 'العربية', so: 'Soomaali' };
const DOC = { birth: 'birth certificate', passport: 'passport or national ID card', diploma: 'diploma or certificate', transcript: 'academic transcript', marriage: 'marriage certificate', other: 'official document' };
function prompt(doc, to) {
  const L = LANG[to] || 'English';
  return 'You are a professional document translator. The images or PDF show one ' + (DOC[doc] || DOC.other) + ' (possibly several pages).\n' +
    'Read every piece of text (printed, stamped or handwritten) and translate it into ' + L + '.\n' +
    'Return ONLY JSON: {"source_language": string (in English, e.g. "Somali"), "title": string (document title in ' + L + '),\n' +
    ' "fields": [{"label": string in ' + L + ', "value": string}] for every labelled item in reading order (names, dates, numbers, places, issuing authority, signatures/stamps described in brackets),\n' +
    ' "body": string in ' + L + ' for any free paragraphs (empty string if none),\n' +
    ' "labels": {"header": "TRANSLATION" in ' + L + ', "from": "Translated from" in ' + L + ', "disclaimer": "Unofficial translation prepared with automated tools. Not a certified translation." in ' + L + '}}\n' +
    'Rules: keep personal names in Latin letters as written in the original (transliterate if the original is in another script); keep numbers and dates exactly; write dates as YYYY-MM-DD when unambiguous; ' +
    'if text is unreadable write [illegible]; never invent information.';
}
export default {
  id: 'translator', url: 'https://axm-03.pages.dev', button: 'Translate',
  defaults: { appName: 'Document Translator', freeAllowance: 1, x_aiModel: 'gemini-flash-latest', x_aiFallback: 'gemini-flash-lite-latest', x_aiDailyBudget: 300, x_aiUserDaily: 20, plans: [
    { id: 'd1', label: '1 document', days: 0, credits: 1, usd: 3, stars: 200, region: 'ALL' }, { id: 'd5', label: '5 documents', days: 0, credits: 5, usd: 12, stars: 850, region: 'ALL' },
    { id: 'pro_m', label: 'Unlimited · 1 month', days: 30, credits: 0, usd: 15, stars: 1000, region: 'ALL' }] },
  secrets: ['GEMINI_KEY'],
  schema: { Translations: ['tr_id', 'user_id', 'doc', 'source_language', 'target', 'title', 'pages', 'created_at'] },
  indexes: { Translations: [[['user_id']]] },
  routes: {
    async trHistory(ctx, req, A) {
      return { ok: true, items: (await ctx.E.db.sel('Translations', { user_id: ctx.uid }, { order: 'rowid DESC', limit: 20 })).map((r) => ({ doc: r.doc, title: r.title, from: r.source_language, to: NAME[r.target] || r.target, created: A.iso(r.created_at) })) };
    },
    async trTranslate(ctx, req, A) {
      const a = await A.accessFor(ctx); if (!a.entitled) return { ok: true, allowed: false, access: a };
      const pages = (req.pages || []).slice(0, 3), to = LANG[req.to] ? req.to : 'en', doc = DOC[req.doc] ? req.doc : 'other';
      if (!pages.length) return { ok: false, error: 'pages' };
      const parts = [{ text: prompt(doc, to) }]; let total = 0;
      pages.forEach((p) => { const d = String(p.data || ''); total += d.length; parts.push({ inline_data: { mime_type: /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(p.mime) ? p.mime : 'image/jpeg', data: d } }); });
      if (total > 15 * 1024 * 1024) return { ok: false, error: 'too_large' };
      let res; try { res = await A.aiCall(ctx, parts); } catch (e) { return { ok: false, error: /^ai_(budget|user_cap)$/.test(e.message) ? e.message : 'ai_failed' }; }
      const c = await A.consume(ctx, { tool: 'document' }); if (!c.allowed) return { ok: true, allowed: false, access: c.access };
      const out = { target: to, target_name: NAME[to], source_language: String(res.source_language || '').slice(0, 40), title: String(res.title || '').slice(0, 120),
        fields: (res.fields || []).slice(0, 60).map((f) => ({ label: String(f.label || '').slice(0, 80), value: String(f.value || '').slice(0, 400) })), body: String(res.body || '').slice(0, 6000), labels: res.labels || {} };
      ctx.E.defer(ctx.E.db.ins('Translations', { tr_id: crypto.randomUUID().slice(0, 12), user_id: ctx.uid, doc, source_language: out.source_language, target: to, title: out.title, pages: pages.length, created_at: new Date() }));
      return { ok: true, allowed: true, access: c.access, token: c.token, result: out };
    }
  }
};
