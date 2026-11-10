/* axm-cron: the clock for every Mini App on D1 (replaces Apps Script time triggers).
   Every 5 minutes it calls each app's /api/cron with the shared CRON_KEY: job=5min always, job=hourly at the top of
   the hour, job=daily at 03:00 UTC. Apps still on Google answer "skipped". APPS = comma-separated site URLs. */
export default {
  async scheduled(event, env, ctx) {
    const d = new Date(event.scheduledTime), jobs = ['5min'];
    if (d.getUTCMinutes() < 5) jobs.push('hourly');
    if (d.getUTCHours() === 3 && d.getUTCMinutes() < 5) jobs.push('daily');
    const apps = String(env.APPS || '').split(',').map((s) => s.trim()).filter(Boolean);
    ctx.waitUntil(Promise.all(apps.map(async (base) => {
      for (const job of jobs) { try { await fetch(base + '/api/cron?job=' + job, { method: 'POST', headers: { 'x-cron-key': env.CRON_KEY } }); } catch (e) {} }
    })));
  },
  async fetch() { return new Response('axm-cron is running', { headers: { 'content-type': 'text/plain' } }); }
};
