"""Builds 'Launch kit - 7 apps' (+ zip): per app PASTE-THIS.gs + logo.png, one checklist page, one answers form.
Usage: python3 tools/launch_kit.py <out_dir> <admin_id>"""
import html, pathlib, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
out_dir = pathlib.Path(sys.argv[1]); admin = sys.argv[2] if len(sys.argv) > 2 else 'YOUR_TELEGRAM_ID'
kit = out_dir / 'Launch kit - 7 apps'
APPS = [  # (n, app id, name, suggested bot username, logo, extra property, note)
  (1, 'gatekeeper', 'Channel Pass', 'ChannelPass0_bot', 'channel-pass', '', 'After launch: add the bot as admin to a test channel.'),
  (2, 'coach', 'Interview Coach', 'InterviewCoach0_bot', 'interview-coach', 'GEMINI_KEY', 'Needs the Gemini key for AI scoring.'),
  (3, 'translator', 'Document Translator', 'DocTranslator0_bot', 'document-translator', 'GEMINI_KEY', 'Needs the Gemini key for translation.'),
  (4, 'rsvp', 'Invitations', 'Invitations0_bot', 'invitations', '', ''),
  (5, 'scholar', 'Scholarship Finder', 'ScholarshipFinder0_bot', 'scholarship-finder', '', ''),
  (6, 'debt', 'Debt Book', 'DebtBook0_bot', 'debt-book', '', ''),
  (7, 'market', 'Field Tasks', 'FieldTasks0_bot', 'field-tasks', '', ''),
]
if kit.exists(): shutil.rmtree(kit)
kit.mkdir(parents=True)
for n, app, name, bot, logo, extra, note in APPS:
    d = kit / f'{n} {name}'; d.mkdir()
    src = root / 'apps' / app / 'apps-script'
    parts = [(src / 'Core.gs').read_text()] + [f.read_text() for f in sorted(src.glob('*.gs')) if f.name != 'Core.gs']
    (d / 'PASTE-THIS.gs').write_text('/* ' + name + ' — PASTE THIS WHOLE FILE into Code.gs in Apps Script (replace everything that is there). */\n\n' + '\n\n'.join(parts))
    shutil.copy(root / 'brand' / f'{logo}-logo.png', d / 'logo.png')

answers = ['SEND ME THIS WHOLE TEXT when the 7 lines are filled in.',
           'Only the Web app URL and the bot username. NEVER put a bot token here.', '']
for n, app, name, bot, logo, extra, note in APPS:
    answers.append(f'{n} {name:<20} URL:                                        Bot: @')
(kit / 'MY-ANSWERS.txt').write_text('\n'.join(answers) + '\n')

rows = ''.join(f"""<tr><td><input type="checkbox" data-k="r{n}"></td><td><b>{n}. {html.escape(name)}</b><br><small>folder <code>{n} {html.escape(name)}</code></small></td>
<td>{html.escape(name)}<br><small>username e.g. <code>{bot}</code></small></td><td><code>BOT_TOKEN_{app}</code>{('<br><code>' + extra + '</code>') if extra else ''}</td><td><small>{html.escape(note)}</small></td></tr>""" for n, app, name, bot, logo, extra, note in APPS)

page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Launch all 7 apps</title><style>
:root{{--bg:#f6f7f9;--card:#fff;--ink:#101828;--mut:#667085;--line:#e4e7ec;--acc:#2457d6;--soft:#eef4ff;--warn:#fff6ed;--warnl:#fddcab}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0f1420;--card:#171e2c;--ink:#e6e9ef;--mut:#98a2b3;--line:#2a3345;--acc:#7aa2ff;--soft:#1d2a47;--warn:#2b2113;--warnl:#5c4316}}}}
body{{font:15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px 16px;color:var(--ink);background:var(--bg)}}
h1{{font-size:26px;margin:0 0 4px}}h2{{font-size:19px;margin:26px 0 8px}}.sub{{color:var(--mut);margin:0 0 16px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 12px}}
code{{background:var(--soft);border-radius:6px;padding:1px 6px;font-size:13px}}small{{color:var(--mut)}}
table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{border-top:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}}
ol{{padding-left:22px}}ol li{{margin:6px 0}}.time{{display:inline-block;font-size:12px;font-weight:600;background:var(--soft);color:var(--acc);border-radius:999px;padding:2px 10px;margin-left:6px;vertical-align:middle}}
.warn{{background:var(--warn);border-color:var(--warnl)}}label{{cursor:pointer}}a{{color:var(--acc)}}
.wrap{{overflow-x:auto}}
</style></head><body>
<h1>Launch all 7 apps</h1><p class="sub">Do each round for all 7 apps, then move to the next round. About 40 minutes in total.</p>

<div class="card warn"><b>Bot tokens stay private.</b> Paste each token only into Google (Round 2). Never send a token to me or anyone. I only need the Web app URLs and bot usernames.</div>

<div class="card wrap"><table><tr><th></th><th>App</th><th>Bot name (Round 1)</th><th>Script properties (Round 2)</th><th>Note</th></tr>{rows}</table>
<p style="margin:10px 0 0"><small>Every app also gets <code>ADMIN_IDS</code> = <code>{html.escape(admin)}</code> (your Telegram ID, the same as in PDF Tools).</small></p></div>

<h2>Round 1 — Telegram: create the 7 bots <span class="time">~10 min</span></h2>
<div class="card"><ol>
<li>Open <b>@BotFather</b> and send <code>/newbot</code>.</li>
<li>Type the <b>name</b> from the table (for example <i>Debt Book</i>), then a <b>username</b> that ends in <code>bot</code>. If it is taken, add a number.</li>
<li>BotFather sends a <b>token</b> (looks like <code>123456:ABC…</code>). Keep it open — you will paste it in Round 2.</li>
<li>Send <code>/setuserpic</code>, choose the bot, and send that app's <code>logo.png</code> <b>as a photo</b>.</li>
<li>Repeat for all 7 bots.</li></ol>
<small>The description, menu button and commands are set automatically in Round 2.</small></div>

<h2>Round 2 — Google: one project per app <span class="time">~3 min each</span></h2>
<div class="card"><ol>
<li>Open <a href="https://script.google.com" target="_blank" rel="noopener">script.google.com</a> → <b>New project</b>. Click <i>Untitled project</i> and rename it to the app name.</li>
<li>In <code>Code.gs</code> delete everything, paste the whole <code>PASTE-THIS.gs</code> from that app's folder, press <b>Ctrl+S</b>.</li>
<li><b>Project Settings</b> (gear, left) → <b>Script properties</b> → add:<br>
<code>ADMIN_IDS</code> = <code>{html.escape(admin)}</code><br><code>BOT_TOKEN_…</code> (name from the table) = the token from BotFather<br>
<small>Interview Coach and Document Translator also: <code>GEMINI_KEY</code> = your Gemini key (see below).</small><br>Press <b>Save script properties</b>.</li>
<li>Back to the <b>Editor</b> (<code>&lt;&gt;</code>). Choose <code>install</code> in the function list → <b>Run</b>. The first time: <i>Review permissions</i> → your account → <i>Advanced</i> → <i>Go to … (unsafe)</i> → <b>Allow</b> (it is your own script). Wait for “Execution completed”.</li>
<li>Choose <code>connectTelegram</code> → <b>Run</b>. The log ends with “Done. The bot is connected…”.</li>
<li><b>Deploy</b> → <b>New deployment</b> → gear → <b>Web app</b>. Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. → <b>Deploy</b> → copy the <b>Web app URL</b>.</li>
<li>Paste the URL and the bot username into <code>MY-ANSWERS.txt</code> on that app's line.</li></ol>
<small>Do not press /start in the new bots yet; Telegram keeps the message until Round 3 is done.</small></div>

<div class="card"><b>Gemini key</b> (Interview Coach and Document Translator): open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → <b>Create API key</b> → copy. The same key works for both apps. You can also add it later; until then those two apps open but AI scoring and translation show an error.</div>

<h2>Round 3 — send me the answers <span class="time">~5 min, my part</span></h2>
<div class="card">Copy the whole text of <code>MY-ANSWERS.txt</code> into our chat. I check each URL (it tells me which app it is, so mix-ups are caught), connect all 7 to Cloudflare, publish them and send you a status table.</div>

<h2>Round 4 — start the bots <span class="time">~5 min</span></h2>
<div class="card"><ol><li>When I say <b>connected</b>, open each new bot, press <b>/start</b>, and open the app once.</li><li>Say <b>“done, check”</b>. I check the sheets and the speed copy for all 7.</li></ol></div>

<h2>If something goes wrong</h2>
<div class="card"><table>
<tr><td>“Script function not found”</td><td>The code was not saved. Press Ctrl+S, then run again.</td></tr>
<tr><td>connectTelegram says “Set Script property BOT_TOKEN_… first”</td><td>Check the property name exactly as in the table, e.g. <code>BOT_TOKEN_debt</code> (lowercase), and press Save script properties.</td></tr>
<tr><td>Web app URL ends in <code>/dev</code></td><td>Use <b>New deployment</b>, not Test deployment. The URL must end in <code>/exec</code>.</td></tr>
<tr><td>Bot does not answer after Round 4</td><td>Run <code>connectTelegram</code> again in that project, then /start.</td></tr>
</table></div>
<script>try{{document.querySelectorAll('[data-k]').forEach(function(c){{c.checked=localStorage.getItem('lk_'+c.dataset.k)==='1';c.onchange=function(){{localStorage.setItem('lk_'+c.dataset.k,c.checked?'1':'0')}}}})}}catch(e){{}}</script>
</body></html>"""
(kit / 'LAUNCH-ALL-7.html').write_text(page)
zp = shutil.make_archive(str(out_dir / 'Launch kit - 7 apps'), 'zip', out_dir, 'Launch kit - 7 apps')
print('kit:', kit, '\nzip:', zp)
