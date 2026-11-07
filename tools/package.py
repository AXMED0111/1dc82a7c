"""Builds the 'Telegram mini apps' folder + zip for Ahmed's PC. Usage: python3 tools/package.py <out_dir> <sites.json>"""
import json, shutil, sys, pathlib, html
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) / 'Telegram mini apps'
sites = json.loads(pathlib.Path(sys.argv[2]).read_text())
APPS = [  # (folder, app id, name, what it does, extra script properties)
  ('01 Channel Pass', 'gatekeeper', 'Channel Pass — paid-channel gatekeeper', 'Creators sell access to private channels. Bot lets buyers in and removes them when the plan ends.', []),
  ('02 Interview Coach', 'coach', 'Interview Coach', 'Voice answers to interview questions, scored by AI with clear feedback.', ['GEMINI_KEY']),
  ('03 Document Translator', 'translator', 'Document Translator', 'Photo of a certificate or ID in, formatted English / Arabic / Somali PDF out.', ['GEMINI_KEY']),
  ('04 Invitations RSVP', 'rsvp', 'Invitations — event / wedding RSVP', 'Invitations, guest list, RSVP replies, QR tickets and door check-in.', []),
  ('05 Scholarship Finder', 'scholar', 'Scholarship Finder', 'Profile-based scholarship matches with deadline alerts.', []),
  ('06 Debt Book', 'debt', 'Debt Book — reminders for traders', 'Shops record customer credit; polite reminders by WhatsApp, SMS or the bot.', []),
  ('07 Field Tasks', 'market', 'Field Tasks — field data marketplace', 'Businesses post small paid tasks; local workers submit photos/GPS/answers and earn USDT.', []),
  ('00 Control Center (admins)', 'control', 'Control Center — admin bot for all apps', 'Income per app, subscribers, forecast, support inbox, app health, AI assistant (DeepSeek), admin roles, executive PDF.', ['DEEPSEEK_KEY (optional)', 'GEMINI_KEY (optional)']),
  ('08 PDF Tools', 'converter', 'PDF Tools — file converter', 'Images to PDF, merge, split, PDF to images. 2 free conversions, then subscription.', []),
]
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)
rows = []
for folder, app, name, what, extra in APPS:
    src = root / 'apps' / app; dst = out / folder
    shutil.copytree(src / 'public', dst / 'public')
    shutil.copytree(src / 'apps-script', dst / 'apps-script')
    shutil.copytree(src / 'netlify', dst / 'netlify')
    if (src / 'functions').exists(): shutil.copytree(src / 'functions', dst / 'functions')
    shutil.copy(src / 'netlify.toml', dst / 'netlify.toml')
    gs = sorted(p.name for p in (src / 'apps-script').glob('*.gs'))
    props = ['ADMIN_IDS', 'BOT_TOKEN_' + app] + extra
    rows.append((folder, app, name, what, gs, props, sites.get(app, '')))
css = """body{font:15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:880px;margin:0 auto;padding:24px 16px;color:#101828;background:#f6f7f9}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}h3{font-size:16px;margin:0 0 6px}.sub{color:#667085;margin:0 0 18px}
.card{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:16px 18px;margin:0 0 12px}code{background:#f2f4f7;border-radius:6px;padding:1px 6px;font-size:13px}
ol li{margin:4px 0}.tag{display:inline-block;font-size:12px;font-weight:600;background:#eef4ff;color:#2457d6;border-radius:999px;padding:2px 9px;margin-right:6px}
table{border-collapse:collapse;width:100%;font-size:14px}td{border-top:1px solid #e4e7ec;padding:7px 6px;vertical-align:top}td:first-child{color:#667085;width:34%}
.warn{background:#fff6ed;border-color:#fddcab}a{color:#2457d6}"""
cards = []
for folder, app, name, what, gs, props, url in rows:
    cards.append(f"""<div class="card"><h3>{html.escape(name)}</h3><p style="margin:0 0 8px;color:#475467">{html.escape(what)}</p><table>
<tr><td>Folder</td><td><code>{html.escape(folder)}</code></td></tr>
<tr><td>Live app (Cloudflare)</td><td>{f'<a href="{url}">{url}</a>' if url else '— (deploy pending)'}</td></tr>
<tr><td>Apps Script files</td><td>{' + '.join('<code>'+g+'</code>' for g in gs)} &nbsp;(from <code>apps-script/</code>)</td></tr>
<tr><td>Script properties</td><td>{' '.join('<code>'+p+'</code>' for p in props)}</td></tr>
<tr><td>API URL goes in</td><td><code>public/config.js</code> → <code>apiUrl: '…/exec'</code> (app id <code>{app}</code>)</td></tr></table></div>""")
page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Telegram Mini Apps — Start here</title><style>{css}</style></head><body>
<h1>Telegram Mini Apps — start here</h1><p class="sub">8 apps · each = front end (Netlify) + its own Google Apps Script backend (its own API URL) + a Telegram bot.</p>
<div class="card warn"><b>Never put secrets</b> (bot tokens, API keys, wallet private keys) in <code>config.js</code>, in chat, or in GitHub. They go only in <b>Apps Script → Project Settings → Script properties</b> and in <b>Cloudflare Pages → Settings → Variables and Secrets</b>.</div>
<h2>First: one shared master sheet (needed for the Control Center)</h2><div class="card">Install the <b>Control Center first</b> (folder 00). Its <code>install</code> creates the master sheet and saves <code>MASTER_SHEET_ID</code> in its Script properties.
Copy that value into <b>every other app's</b> Script properties <b>before</b> running their <code>install</code>. Then all apps write to the same private sheet and the Control Center sees income, subscribers, tickets and health of every app — including any new mini app you add later.</div>
<h2>Admins and roles</h2><div class="card"><code>ADMIN_IDS</code> (your Telegram ID) = owner / super admin in every app. In Control Center → <b>Admins</b> you can add people per app with rights: <b>support</b> (inbox), <b>payments</b> (approve payments), <b>settings</b> (prices, codes), <b>reports</b> (dashboard, health). They only see their apps.</div>
<h2>Do this for each app (about 10 minutes per app)</h2><div class="card"><ol>
<li><b>Backend.</b> Go to <a href="https://script.google.com">script.google.com</a> → <b>New project</b>. Rename it after the app. Delete the sample code, then create one file per <code>.gs</code> file in the app's <code>apps-script/</code> folder (names as shown) and paste each file's contents.</li>
<li><b>Script properties.</b> Project Settings (gear) → Script properties → add <code>ADMIN_IDS</code> = your Telegram user ID (get it from @userinfobot) and the bot token as <code>BOT_TOKEN_&lt;app id&gt;</code>. AI apps also need <code>GEMINI_KEY</code> (from aistudio.google.com).<br><small>Optional: to use ONE ledger for all apps, copy <code>MASTER_SHEET_ID</code> from the first project into the others before step 3.</small></li>
<li><b>Install.</b> Select the function <code>install</code> → <b>Run</b> → approve permissions. It creates the private master sheet and the daily/hourly jobs.</li>
<li><b>Deploy the API.</b> Deploy → New deployment → type <b>Web app</b> → Execute as <b>Me</b> → Who has access <b>Anyone</b> → Deploy. Copy the <b>Web app URL</b> (ends with <code>/exec</code>). <b>This is the app's API — send it to Claude.</b> It is not a secret.</li>
<li><b>Bot.</b> In Telegram open <b>@BotFather</b> → <code>/newbot</code>. Put the token only in Script properties (step 2) and Netlify (step 7). Optional: <code>/newapp</code> to get a short name for direct <code>t.me/bot/app</code> links (set <code>botUsername</code> + <code>appShortName</code> in <code>config.js</code>).</li>
<li><b>Connect the bot.</b> In the app's Apps Script file set <code>THIS_APP.url</code> to the app's Cloudflare URL (<code>https://&lt;project&gt;.pages.dev</code>), save, then run <code>connectTelegram</code>. It sets the webhook, the menu button and the commands.</li>
<li><b>Hosting (free): Cloudflare Pages.</b> dash.cloudflare.com → Workers &amp; Pages → Create → Pages → <b>Connect to Git</b> → repo <code>AXMED0111/1dc82a7c</code>. Project name e.g. <code>debt-book</code>. Build command: <i>none</i>. <b>Root directory:</b> <code>apps/&lt;app id&gt;</code>. <b>Build output directory:</b> <code>public</code>. The bot webhook in <code>functions/api/telegram.js</code> is deployed automatically. Every future update I push to GitHub goes live by itself — no credits.</li>
<li><b>Cloudflare variables</b> (project → Settings → Variables and Secrets, type <i>Secret</i> for the first three): <code>BOT_TOKEN</code>, <code>WEBHOOK_SECRET</code> (copy <code>WEBHOOK_SECRET_&lt;app&gt;</code> from Script properties), <code>SERVER_SECRET</code> (from Script properties), <code>GAS_URL</code> (the /exec URL), <code>APP_ID</code> (the app id), <code>APP_URL</code> (e.g. https://debt-book.pages.dev). Then <b>Deployments → Retry deployment</b> once so they apply. Put the same URL in <code>THIS_APP.url</code> and run <code>connectTelegram</code> again.</li>
<li><b>Launch.</b> Open the app as admin → Settings (sliders icon): set prices, USDT addresses, EVC/Zaad/Sahal numbers, then turn <b>Test mode OFF</b>.</li></ol></div>
<h2>The 8 apps</h2>{''.join(cards)}
<h2>Payments (already built in every app)</h2><div class="card"><span class="tag">Stars</span>global, main method · <span class="tag">USDT TRC20 / BEP20</span>unique amount per order, checked on-chain every 5 min (BEP20 needs <code>ETHERSCAN_KEY</code>) · <span class="tag">EVC / Zaad / Sahal / M-Pesa</span>shown only to verified local numbers (+252 by default), admin approves in Settings.<br><br>
Before launch, verify on Telegram's official pages: current Stars fees, payout via TON and hold period, and Apple's rules for in-app payments on iPhone (Stars is the safest option on iOS).</div>
<h2>Engineering guide</h2><div class="card">Open <code>ENGINEERING-GUIDE.md</code>: architecture, security, health targets, playbooks for problems, launch checklist and the growth path. In every app: <b>Settings → System health</b> shows errors, speed, message queue, backups and webhook status; <b>Maintenance mode</b> pauses changes with one tap.</div>
<h2>Testing before your backend is connected</h2><div class="card">With <code>apiUrl</code> empty each app runs in <b>demo mode</b>: everything works on the phone, data stays on that phone, payments are simulated. In Settings → Testing, turn on <b>Simulate free user</b> to see the free limit and the paywall.</div>
</body></html>"""
(out / 'START HERE.html').write_text(page)
shutil.copy(root / 'docs' / 'ENGINEERING.md', out / 'ENGINEERING-GUIDE.md')
print('packaged', out)
