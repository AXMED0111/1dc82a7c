# Move to Cloudflare D1 — plan (decided 2026-11-10)

Goal: every Mini App feels instant on first use (good first impression), and the system serves thousands of
users. Google Sheets stop being the live database; they become the **mirror and backup**. Every night each
app (and the central database) also saves a **JSON backup file to Google Drive**.

Owner decision: "I will allow everything". Paid Cloudflare ($5/month, whole account) when the numbers need it.

## Target architecture

| Piece | Today | After |
|---|---|---|
| Live data | Each app's Google Sheet (Apps Script) | **One D1 database per app** (`axm-<app>`) + `axm-edge` (central numbers, app directory, admins, support inbox, edge cache) — 10 databases = Free plan maximum |
| API | Apps Script Web App behind `/api/app` (edge copy) | **Pages Function `/api/app` runs the logic itself** (same actions, same answers — front ends unchanged) |
| Telegram webhook | `/api/telegram` forwards to Apps Script | Handled in the Pages Function directly |
| Background jobs | Apps Script triggers (5 min / hourly / daily) | One Worker **`axm-cron`** with a Cron Trigger (outbox, USDT checks, expiries, reminders, central numbers) |
| Secrets (bot tokens, Gemini, DeepSeek, TronGrid…) | Apps Script Script properties | Encrypted (AES-GCM) in the app's D1 `secrets` table; key `MASTER_KEY` = Cloudflare secret. Pushed once by the owner's Apps Script during migration — never typed in chat |
| Sheets | Live database | **Mirror**: nightly copy of every table into the app's own sheet; central numbers into the central sheet |
| Backups | Daily sheet copy in Drive | Nightly **JSON per app + central** in Drive folder `Mini Apps backups/<app>/YYYY-MM-DD.json` (keep 30) + the sheet mirror |

Apps Script keeps only one small job per Google account: nightly export → Drive JSON + Sheets mirror
(runs in the Control Center project).

## Free-plan limits to respect (Workers Free)
- 100,000 requests/day for the whole account; **10 ms CPU per request** (I/O does not count) → keep requests light,
  precompute aggregates in cron; no whole-table scans (D1 bills rows *scanned*): every query uses an index.
- D1: 10 databases, 500 MB each, 5 GB total; 5 M rows read/day, 100 k rows written/day (queries fail above, since 2026-09-01).
- If D1 fails, the front end falls back to `directUrl` (Apps Script) while it still exists.
- Move to Workers Paid ($5/month: 10 M requests/month, 30 s CPU, 25 B reads, 50 M writes, 50 000 DBs) when
  Control Center shows ~70 k requests/day or CPU-limit errors.

## Phases
**A. Smooth now (front end + edge, no owner work)** — done first:
1. A save no longer wipes the phone's saved screens; they are marked "check again" and shown instantly.
2. For 60 s after a save, background refreshes bypass the Cloudflare copy (`fresh:1`) so the next screen is right.
3. Cloudflare keeps the writer's copies (no delete); other users' copies are "check again" (epoch).
4. Learned prefetch: on app open, screens used recently are refreshed in the background.

**B. D1 backend (one app at a time, Debt Book first)**
1. Shared engine `shared/worker/`: request auth (initData HMAC), roles, idempotency (rid), rate limit, maintenance,
   audit, metrics, settings, users/usage/access/consume, plans/codes/referrals, payments (Stars invoices + webhook,
   USDT TRC20/BEP20 checks, manual mobile money approvals), outbox, tickets, central numbers, secrets store.
   Data layer: async `sel/one/ins/upd/del` over D1 with indexes; schema generated from the same SCHEMA lists.
2. `tools/build.py` bundles engine + app module into `apps/<app>/functions/` (wrangler bundles imports).
3. Migration: Apps Script `migrateToCloudflare()` pushes every tab + secrets to `/api/migrate` (HMAC with the
   webhook secret Cloudflare already knows). Idempotent; can be re-run; old sheet untouched.
4. Switch: Cloudflare variable `BACKEND=d1` per app (instant switch back = `BACKEND=gas`).
5. Tests: the same `tools/test-backends.js` actions run against the D1 engine (mock D1 = node:sqlite).
6. Order: Debt Book (pilot) → Invitations → PDF Tools → Interview Coach → Document Translator → Channel Pass →
   Scholarship Finder → Field Tasks → Control Center.

**C. Nightly backup job** (Control Center Apps Script): for each app `/api/export` (secret) → JSON file in Drive
+ overwrite the app sheet's tabs; central numbers → central sheet. Keep 30 days.

## Status
- Phase A done and live (2026-11-10).
- B1 engine `shared/worker/engine.js` + Debt Book module `apps/debt/worker/debt.js`; test bench `tools/d1-sim.mjs`,
  tests `node tools/test-d1.mjs` (107 checks). Measured 0.6–3.3 ms per request (40 customers / 400 entries).
- Decision: build and test ALL apps on D1 first, then one migration day for all (central data never split between
  Google and D1). Each app can switch back (`BACKEND=gas`). New apps (Scholarship Finder, Field Tasks) start on D1.
- Follow-up: very large shops (thousands of entries) → page the ledger in dbBook (CPU limit on the free plan).

- B2 (Debt Book): D1 `axm-debt` (e0e9b2c4…) bound as DB, axm-edge as EDGE + CENTRAL, MASTER_KEY + CRON_KEY secrets set;
  functions deployed with BACKEND unset (still Google). `axm-cron` Worker live (every 5 min → /api/cron of all 9 sites).
  Next: owner pastes new Debt Book code and runs migrateToCloudflare → verify rows in axm-debt → set BACKEND=d1 and
  clear directUrl in apps/debt/public/config.js (no fallback writes to the old sheet) → redeploy.
- During the pilot, Debt Book's tickets/numbers go to the D1 central; Control Center (Google) shows them after it moves.

- 2026-11-10: Debt Book LIVE on D1. Databases moved to Western Europe (closest region to East Africa; D1's region is
  fixed at creation, so they were copied with `tools/d1_copy.py`): `axm-debt-eu` ebf7f065… (DB), `axm-central-eu`
  bbf9c5ba… (CENTRAL); `axm-edge` e1b31b31… stays as EDGE (edge cache + learned webhook secrets in `meta`).
  Pages Smart Placement on: the function runs next to its database, so database round trips are short.
  Old `axm-debt` (ENAM) kept as an extra copy for now. New app databases: create with primary_location_hint "weur".
- Engine prefetch: one database round for what every request needs; front end: in-place screen updates (no flashing),
  saves never disappear (pending + 30 s overlay; reads started before a save are re-checked).

## Owner steps (only these)
- Phase A: none.
- Phase B per app: paste the new `PASTE-THIS.gs` once, run `migrateToCloudflare`, check the app, say "done".
- Phase C: paste the new Control Center code once, run `installBackups`.
