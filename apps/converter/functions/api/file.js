import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
const D1 = createApp(MOD);
// Raw-byte uploads (converted files, PDF reports) sent on to the user's Telegram chat.
export const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? D1.file(c) : new Response('{"ok":false,"error":"not_configured"}'));
