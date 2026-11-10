import { createApp } from '../../lib/engine.js';
import MOD from '../../lib/module.js';
const D1 = createApp(MOD);
// Nightly backup (Control Center Apps Script) reads every table here, signed.
export const onRequestGet = (c) => D1.exportRows(c);
