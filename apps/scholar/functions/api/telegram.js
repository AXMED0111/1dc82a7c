import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
import { onRequest as toGoogle } from '../../lib/forwarder.js';
const D1 = createApp(MOD);
export const onRequest = (c) => (c.env.BACKEND === 'd1' && c.request.method === 'POST' ? D1.telegram(c) : toGoogle(c));
