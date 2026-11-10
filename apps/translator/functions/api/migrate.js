import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
const D1 = createApp(MOD);
// Apps Script migrateToCloudflare() posts each tab here, signed with the webhook secret (works before the switch).
export const onRequestPost = (c) => D1.migrate(c);
