import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
import { onRequestPost as viaGoogle } from '../../lib/edge.js';
const D1 = createApp(MOD);
// BACKEND=d1: answer from this app's D1 database; otherwise the edge copy in front of Apps Script.
export const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? D1.app(c) : viaGoogle(c));
