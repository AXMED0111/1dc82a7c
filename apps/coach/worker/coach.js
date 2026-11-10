/* Interview Coach on Cloudflare D1 — the D1 twin of apps/coach/apps-script/Coach.gs.
 * The app sends a 16 kHz WAV answer; Gemini transcribes and scores it in one call. Charged only when scoring succeeds. */
const KIND = { job: 'a job interview', visa: 'a student visa interview at an embassy', scholar: 'a scholarship selection panel interview', english: 'an English speaking practice test' };
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
function prompt(cat, question, lang) {
  return 'You are an experienced interview coach. The candidate is practising for ' + (KIND[cat] || KIND.job) + '.\n' +
    'Question asked: "' + question + '"\n' +
    'Listen to the audio answer. Transcribe it, then evaluate it honestly and kindly.\n' +
    'Return ONLY JSON with this shape:\n' +
    '{"transcript": string, "overall": 0-100, "scores": {"content": 0-100, "structure": 0-100, "clarity": 0-100, "confidence": 0-100},\n' +
    ' "strengths": [2-3 short strings], "improvements": [2-3 short, specific, actionable strings], "better_answer": string (a model answer of 80-120 words in first person, based on what the candidate said)}\n' +
    'Rules: if the audio is silent or not an answer, give low scores and say so in improvements. ' +
    'Write strengths, improvements and better_answer in ' + (lang === 'so' ? 'Somali (but keep better_answer in English, since the interview is in English)' : 'English') + '. The transcript stays in the spoken language.';
}
export default {
  id: 'coach', url: 'https://axm-02.pages.dev', button: 'Practice',
  defaults: { appName: 'Interview Coach', freeAllowance: 2, x_aiModel: 'gemini-flash-latest', x_aiFallback: 'gemini-flash-lite-latest', x_aiDailyBudget: 500, x_aiUserDaily: 30, plans: [
    { id: 's1', label: '1 session', days: 0, credits: 1, usd: 1, stars: 75, region: 'ALL' }, { id: 's10', label: '10 sessions', days: 0, credits: 10, usd: 7, stars: 500, region: 'ALL' },
    { id: 'pro_m', label: 'Unlimited · 1 month', days: 30, credits: 0, usd: 9, stars: 650, region: 'ALL' }] },
  secrets: ['GEMINI_KEY'],
  schema: { Sessions: ['session_id', 'user_id', 'category', 'question', 'seconds', 'overall', 'content', 'structure', 'clarity', 'confidence', 'transcript', 'created_at'] },
  indexes: { Sessions: [[['user_id']]] },
  routes: {
    async coHistory(ctx, req, A) {
      return { ok: true, items: (await ctx.E.db.sel('Sessions', { user_id: ctx.uid }, { order: 'rowid DESC', limit: 20 })).map((r) => ({ category: r.category, question: r.question, score: r.overall, created: A.iso(r.created_at) })) };
    },
    async coReport(ctx, req, A) {
      if (!(await A.isPro(ctx))) return { ok: true, allowed: false };
      return { ok: true, allowed: true, sessions: (await ctx.E.db.sel('Sessions', { user_id: ctx.uid })).map((r) => ({ category: r.category, question: r.question, score: Number(r.overall) || 0, created: A.iso(r.created_at),
        scores: { content: Number(r.content) || 0, structure: Number(r.structure) || 0, clarity: Number(r.clarity) || 0, confidence: Number(r.confidence) || 0 } })) };
    },
    async coScore(ctx, req, A) {
      const a = await A.accessFor(ctx); if (!a.entitled) return { ok: true, allowed: false, access: a };
      const audio = String(req.audio || ''); if (audio.length < 1000) return { ok: false, error: 'too_short' };
      if (audio.length > 8 * 1024 * 1024) return { ok: false, error: 'too_large' };
      const question = String(req.question || '').slice(0, 300), cat = KIND[req.category] ? req.category : 'job'; let res;
      try { res = await A.aiCall(ctx, [{ text: prompt(cat, question, req.lang) }, { inline_data: { mime_type: 'audio/wav', data: audio } }]); }
      catch (e) { return { ok: false, error: /^ai_(budget|user_cap)$/.test(e.message) ? e.message : 'ai_failed' }; }
      const c = await A.consume(ctx, { tool: 'session' }); if (!c.allowed) return { ok: true, allowed: false, access: c.access };
      const sc = res.scores || {}, out = { overall: clamp(res.overall), scores: { content: clamp(sc.content), structure: clamp(sc.structure), clarity: clamp(sc.clarity), confidence: clamp(sc.confidence) },
        strengths: (res.strengths || []).slice(0, 4).map(String), improvements: (res.improvements || []).slice(0, 4).map(String), better_answer: String(res.better_answer || '').slice(0, 1500), transcript: String(res.transcript || '').slice(0, 3000) };
      ctx.E.defer(ctx.E.db.ins('Sessions', { session_id: crypto.randomUUID().slice(0, 12), user_id: ctx.uid, category: cat, question, seconds: Number(req.seconds) || 0, overall: out.overall,
        content: out.scores.content, structure: out.scores.structure, clarity: out.scores.clarity, confidence: out.scores.confidence, transcript: out.transcript.slice(0, 1000), created_at: new Date() }));
      return { ok: true, allowed: true, access: c.access, result: out };
    }
  }
};
