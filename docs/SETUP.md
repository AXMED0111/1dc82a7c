# Setup (private)

| App | Netlify site | Folder | Backend module |
|-----|--------------|--------|----------------|
| #8 PDF Tools (converter) | https://dtools-1dc82a7c.netlify.app | apps/converter | backend/Code.gs |
| #1 Channel Pass (gatekeeper) | https://cpass-5cc578be.netlify.app | apps/gatekeeper | backend/gatekeeper.gs |

Netlify account: axmed.pro011@gmail.com (portfolio only).

## 1. Link Netlify to GitHub (once per app, enables the bot webhook function)
Netlify → site → Project configuration → Build & deploy → Link repository → GitHub → `AXMED0111/1dc82a7c`
- Base directory: `apps/converter` (or `apps/gatekeeper`)
- Publish directory: `public` · Functions directory: `netlify/functions` · Build command: empty

## 2. Backend (one Apps Script project for all apps)
1. script.google.com → New project. Create files `Code.gs` and `gatekeeper.gs`, paste the contents from `backend/`.
2. Run `install()` once (approve permissions). It creates the private master sheet and triggers.
3. Project Settings → Script properties: add `ADMIN_IDS` (your Telegram user ID), `BOT_TOKEN_converter`, `BOT_TOKEN_gatekeeper`.
4. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone**. Copy the `/exec` URL.
5. Put that URL in `apps/<app>/public/config.js` → `apiUrl` (public value, not a secret).

## 3. Telegram (one bot per app, from @BotFather)
1. `/newbot` → create the bot. Never paste the token in chat; put it only in Script properties + Netlify env.
2. Gatekeeper only: BotFather → `/newapp` to get a short name; set `botUsername` and `appShortName` in its config.js.
3. Apps Script: run `connectConverter()` / `connectGatekeeper()` (webhook + menu button + commands).

## 4. Netlify environment variables (per site, mark as secret)
`BOT_TOKEN`, `WEBHOOK_SECRET` (= Script property WEBHOOK_SECRET_<app>), `SERVER_SECRET` (= Script property SERVER_SECRET),
`GAS_URL` (the /exec URL), `APP_ID` (`converter` / `gatekeeper`), `APP_URL` (the site URL).

## 5. Launch checklist
- Settings screen: turn TEST MODE off, set prices, wallets, mobile money numbers.
- Verify current Telegram Stars fees/payout terms and iOS payment rules.
- Rebuild gatekeeper after design changes in converter: `python3 tools/build.py gatekeeper`.
