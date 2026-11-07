# Engineering guide — Telegram Mini Apps portfolio

How the ideas in *The Modern Systems Engineering* apply to this stack:
**Google Sheets + Apps Script (backend) · Telegram (identity, payments, messages) · single-file HTML on Netlify (front end).**

The book's rule "complexity must pay rent" decides what we copy. We do **not** add Kubernetes, Kafka or
microservices. We add the *principles* that make a small system safe, observable and reversible.

## 1. Architecture (boundaries before technology)

| Layer | Responsibility | Trust |
|---|---|---|
| Mini App (HTML) | UI only. No secrets, no business rules that matter. | Untrusted — anyone can copy it |
| Apps Script `Core.gs` | Identity (Telegram signature), access, payments, rate limits, audit, metrics | Trusted |
| App module (`Debt.gs`, …) | One business capability; owns its sheets | Trusted, isolated per app |
| Netlify function `telegram.mjs` | Webhook: verifies Telegram's secret header, forwards to Apps Script | Trusted |
| Google Sheet | Durable state (ledger) | Private; only Apps Script reads it |

Each app is a **modular monolith** (book 1.6): one deployable Apps Script project, clear modules inside.

## 2. What was built, mapped to the book

| Book principle | Implementation |
|---|---|
| Identity is the perimeter (5.3, 7.11) | Every request carries Telegram `initData`; HMAC verified server-side, 24 h freshness. The tenant/user id is never taken from the URL or body. |
| Idempotency (1.9, 2.3, 4.2) | Every call has a request id (`rid`). The server stores the answer 15 min; a retry returns the stored answer → no double charge, no double save. Payments use order ids; `markPaid` is safe to repeat. |
| Timeouts, bounded retries with jitter (2.9, 7.6) | 25 s timeout (120 s for AI), one retry with 0.7–1.6 s jitter, never for slow AI calls. |
| Admission control (2.4, 4.11) | Per-user budget (default 90 requests/min) → `rate_limited` with `retryAfter`. AI: per-user daily cap + app-wide daily budget. |
| Queues and backpressure (2.8, 7.5) | Bulk messages go to the `Outbox` sheet; sent in batches of 400 every 5 min. **Oldest message age** is shown in health (the book's best queue signal). |
| AI fenced by deterministic controls (3.1, 3.6, 3.10) | Injection guard in every prompt (files/audio are data, never instructions), JSON-only output validated and clamped, backup model on failure, charge only on success, token telemetry. |
| Evidence over intuition (1.8, 2.10, 7.7) | Request counts, error rate, p95 latency per hour (`Metrics` sheet), queue age, webhook errors, crons heartbeat, backups, sheet capacity → **Settings → System health**. Front-end errors are reported too. |
| Audit / non-repudiation (5.2 STRIDE) | Every admin and creator action is written to `Log` as `audit:<action>` with user and request id. Secret values are never logged. |
| Reversible change (2.21, 7.10) | **Maintenance mode**: read-only with a message, admins unaffected, payments in flight still complete. One tap to undo. Test mode and feature settings are flags, not code. |
| Backups you can restore (2.11, 4.14) | Daily copy of the master sheet, 14 kept, in Drive folder `ledger-backups-…`. |
| Least privilege / tenant isolation (2.12, 5.8) | Owner checks on every channel, event, shop and task; platform discount codes cannot touch creators' prices; admin actions need `ADMIN_IDS`. |
| Fitness functions (2.27) | `node tools/test-backends.js` — 139 automated checks (forged signature rejected, idempotent retry, rate limit, maintenance write list, payments, isolation, AI failover…). Run before every release. |
| Secrets lifecycle (5.5) | Secrets only in Script properties / Netlify env; write-only in Settings; rotate the Netlify token you pasted in chat. |

## 2b. Control Center (control plane)

- One admin bot + Mini App (`apps/control`) reading the **shared master sheet**: income per app (Stars converted at the configured rate), subscribers, forecast, trends, payment methods, new users, tickets, per-app health.
- **Apps registry** (`Apps` sheet): every app registers itself on install and on each background run (heartbeats). New mini apps appear automatically.
- **Roles** (`Admins` sheet): super admins see everything; app admins get `support`, `payments`, `settings`, `reports` for chosen apps only. Enforced on the server for every admin action.
- **Support inbox**: users write from Settings → Contact support, or simply message any bot. Replies are queued and sent by that app's own bot (`Outbox`, each project sends only its own app's messages).
- **AI assistant**: DeepSeek (OpenAI-compatible) with Gemini fallback, given a live snapshot + playbooks. **Read-only** by design (book 3.6/3.14: reads automatic, actions need humans). Daily cost cap.

## 3. Health targets (simple SLOs)

| Signal | Healthy | Act when |
|---|---|---|
| Error rate (24 h) | < 2 % | > 5 % |
| Slow responses (p95) | < 3 s | > 8 s |
| Message queue oldest | < 20 min | > 60 min |
| Background jobs last run | < 10 min | > 30 min |
| Last backup | < 26 h | > 36 h |
| Sheet capacity | < 50 % | > 80 % |

## 4. Playbooks (what to do when…)

| Situation | First checks | Safe actions |
|---|---|---|
| Users say "it doesn't load" | Health: error rate, p95, recent errors | Maintenance mode with a message; check Apps Script executions log |
| Payments not confirmed | Payments to review, webhook pending/last error | Approve manual payments; re-run `connectTelegram()`; check Netlify env vars |
| Messages not arriving | Queue oldest age, failed count | Check bot token; users who blocked the bot show as failed (normal) |
| AI errors / cost spike | AI calls today vs budget, recent `ai_error` | Lower per-user cap, switch backup model, check key/billing at ai.google.dev |
| Sheet getting big (> 50 %) | Sheet capacity | Give the app its own sheet; archive old Log/Outbox rows; plan the database step |
| Suspicious admin change | Audit log | Rotate secrets, review `ADMIN_IDS`, restore yesterday's backup copy if data was damaged |

## 5. Launch readiness checklist

- [ ] `ADMIN_IDS`, `BOT_TOKEN_<app>`, `SERVER_SECRET`, `WEBHOOK_SECRET_<app>` set; Netlify env vars set
- [ ] `install()` run (sheets, triggers); `connectTelegram()` run; health shows webhook "connected"
- [ ] Test mode OFF; prices, wallets, mobile-money numbers, discount codes reviewed
- [ ] One real Stars payment and one USDT payment end to end; one manual EVC approval
- [ ] Backup appears next day; open it once (a backup counts only after a restore test)
- [ ] `node tools/test-backends.js` passes; Somali texts reviewed by a native speaker
- [ ] Telegram Stars fees/payout and iOS payment rules verified on official pages

## 6. Hosting

Front ends + webhook run on **Cloudflare Pages** (free, no credits, commercial use allowed), deployed from GitHub. Root directory `apps/<app>`, output `public`, webhook `functions/api/telegram.js`. The Netlify copy (`netlify/functions/telegram.mjs`) is kept, generated from the same source by `tools/build.py`.

## 6b. Speed: edge copy, signed pass, phone save queue

Apps Script answers in 1.5–3 s even for tiny requests, so phones should rarely wait for it.

| Piece | Where | What it does |
|---|---|---|
| Phone copy | `shared/kit.js` `api()` | Shows the last answer at once and checks the server in the background (60 s fresh, kept 24 h). |
| Edge copy | `shared/edge-proxy.js` → `functions/api/app.js`, D1 `axm-edge` | Cloudflare keeps each person's answers. Under 2 min old: Google is not asked. Under 30 min: answered at once, refreshed in background. Older: waits at most 8 s for Google, else the old copy. Writes always go to Google, clear that person's copies and mark everyone else's "check again". Admin data and payment checks are always live. |
| Signed pass | `edgePass()` in `Core.gs` | 7-day pass `{u, a, x}` signed with a key derived from `WEBHOOK_SECRET_<app>`. Cloudflare learns that secret only after Apps Script accepts a real Telegram update (`telegram-forwarder.js`), so no bot token is stored at Cloudflare. The pass must match the user in `initData`. |
| Phone save queue | `K.queueSave()` | Saves show as done at once, are sent in order in the background and survive closing the app. Each keeps its request id, and records carry a phone-made id (Debt Book `entry`), so a retry is stored once. A small "Saving 1…" pill shows anything waiting. |
| Fallback | `directUrl` in `config.js` | If Cloudflare fails, the retry goes straight to Apps Script. |

Tests: `node tools/test-edge.mjs` (edge copy against the simulator and an in-memory D1) and `node tools/test-backends.js`.

## 7. Growth path (scale only under proven pressure — book 7.16)

1. **Now:** one Apps Script project + one sheet per app. Comfortable for thousands of users per app.
2. **When an app's sheet passes ~50 % or p95 > 3 s:** archive old rows monthly; split heavy tabs into their own spreadsheet.
3. **When Apps Script quotas bind** (Gmail ~20k outside calls/day → Google Workspace 100k/day): upgrade the Google account first — cheapest step.
4. **Only then:** move the busiest app's data to a managed database (e.g. Supabase/Postgres). All data access goes through
   `rows / find / append / update / delRow` in `Core.gs`, so the change is contained in one file.
