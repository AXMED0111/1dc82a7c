import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
const D1 = createApp(MOD);
// Apps Script migrateToCloudflare() posts each tab here, signed with the webhook secret (works before the switch).
const out = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
// Once the app runs on D1 a new copy is refused (it would replace newer data with the old sheet). GET tells Apps Script which system serves the app.
export const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? out({ ok: false, error: 'already_on_d1' }) : D1.migrate(c));
export const onRequestGet = (c) => out({ ok: true, backend: c.env.BACKEND === 'd1' ? 'd1' : 'gas' });
