import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
const D1 = createApp(MOD);
// Raw-byte uploads (converted files, PDF reports) sent on to the user's Telegram chat; GET = a private picture by signed link.
export const onRequest = (c) => (c.env.BACKEND === 'd1' && /^(GET|POST)$/.test(c.request.method) ? D1.file(c) : new Response('{"ok":false,"error":"not_configured"}'));
