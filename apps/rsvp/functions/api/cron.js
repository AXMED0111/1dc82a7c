import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
const D1 = createApp(MOD);
// Called every 5 minutes by the axm-cron Worker (header x-cron-key).
export const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? D1.cron(c) : new Response('{"ok":true,"skipped":"backend is Google"}'));
