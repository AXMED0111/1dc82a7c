"""Connect many apps at once after their Apps Script projects are deployed.

Usage:  python3 tools/connect.py answers.txt [--dry]
answers.txt: free text, one app per line, e.g.
    Debt Book: https://script.google.com/macros/s/AKfy.../exec  @DebtBook0_bot
Labels are optional: every URL is asked "?check=1" and its own answer says which app it is,
so a URL pasted under the wrong name still lands on the right app.
For each app: sets Cloudflare variables GAS_URL + APP_ID, writes public/config.js
(apiUrl '/api/app' = edge copy, directUrl = Apps Script, botUsername), deploys, prints a status table.
Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment. No secrets are written to files.
"""
import json, os, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROJECT = {'gatekeeper': 'axm-01', 'coach': 'axm-02', 'translator': 'axm-03', 'rsvp': 'axm-04', 'scholar': 'axm-05',
           'debt': 'axm-06', 'market': 'axm-07', 'converter': 'axm-08', 'control': 'axm-09'}
NAMES = {'gatekeeper': 'Channel Pass', 'coach': 'Interview Coach', 'translator': 'Document Translator', 'rsvp': 'Invitations',
         'scholar': 'Scholarship Finder', 'debt': 'Debt Book', 'market': 'Field Tasks', 'converter': 'PDF Tools', 'control': 'Control Center'}
SHORT = [(r'channel|pass|gate', 'gatekeeper'), (r'coach|interview', 'coach'), (r'transl', 'translator'), (r'rsvp|invit', 'rsvp'),
         (r'scholar', 'scholar'), (r'debt|ledger', 'debt'), (r'field|task|market', 'market'), (r'pdf|convert', 'converter'), (r'control|center|centre', 'control')]
URL_RE = re.compile(r'https://script\.google\.com/macros/s/[\w-]+/exec')
BOT_RE = re.compile(r'@?\b([A-Za-z][A-Za-z0-9_]{3,30}bot)\b', re.I)


def curl(args, data=None):
    cmd = ['curl', '-sS', '--max-time', '60'] + args
    if data is not None:
        cmd += ['-d', json.dumps(data)]
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def check(url):
    try:
        return json.loads(curl(['-L', url + '?check=1'])).get('setup') or {}
    except Exception as e:
        return {'error': 'no JSON answer (is it deployed as Web app, access Anyone?)'}


def cf_set_env(project, env):
    acct, tok = os.environ['CLOUDFLARE_ACCOUNT_ID'], os.environ['CLOUDFLARE_API_TOKEN']
    body = {'deployment_configs': {'production': {'env_vars': {k: {'type': 'plain_text', 'value': v} for k, v in env.items()}}}}
    r = json.loads(curl(['-X', 'PATCH', '-H', 'Authorization: Bearer ' + tok, '-H', 'content-type: application/json',
                         f'https://api.cloudflare.com/client/v4/accounts/{acct}/pages/projects/{project}'], body))
    return bool(r.get('success')), (r.get('errors') or [''])[0]


def write_config(app, url, bot):
    p = ROOT / 'apps' / app / 'public' / 'config.js'
    old = p.read_text() if p.exists() else ''
    lang = (re.search(r"defaultLang:\s*'(\w+)'", old) or [None, 'en'])[1]
    ver = (re.search(r"version:\s*'([\w.]+)'", old) or [None, '1.0.0'])[1]
    extra = ''
    if app == 'converter':
        extra = "\n  editions: { global: { defaultLang: 'en' }, local: { defaultLang: 'so' } },"
    p.write_text(f"""/* Public config only — NEVER put secrets here. Written by tools/connect.py.
   apiUrl '/api/app' = Cloudflare edge copy (fast); directUrl = this app's Apps Script Web App (fallback, big uploads). */
window.APP_CONFIG = {{
  appId: '{app}',
  apiUrl: '/api/app',
  directUrl: '{url}',
  botUsername: '{bot}',
  appShortName: '',
  defaultLang: '{lang}',{extra}
  version: '{ver}'
}};
""")


def deploy(app):
    r = subprocess.run(['npx', '-y', 'wrangler@3', 'pages', 'deploy', 'public', '--project-name', PROJECT[app], '--branch', 'main', '--commit-dirty=true'],
                       cwd=ROOT / 'apps' / app, capture_output=True, text=True, env=dict(os.environ, WRANGLER_SEND_METRICS='false'))
    return 'Deployment complete' in r.stdout + r.stderr


def main():
    text = pathlib.Path(sys.argv[1]).read_text()
    dry = '--dry' in sys.argv
    found = []
    for line in text.splitlines():
        m = URL_RE.search(line)
        if not m:
            continue
        rest = line.replace(m.group(0), ' ')
        label = next((a for rx, a in SHORT if re.search(rx, rest, re.I)), '')
        b = BOT_RE.search(rest)
        found.append((label, m.group(0), b.group(1) if b else ''))
    if not found:
        sys.exit('No Apps Script URLs found.')
    rows = []
    for label, url, bot in found:
        st = check(url)
        app = st.get('app') or label
        note = []
        if st.get('error'):
            note.append(st['error'])
        if label and st.get('app') and label != st['app']:
            note.append(f'listed as {NAMES.get(label, label)}, but this URL is {NAMES.get(app, app)} (used {NAMES.get(app, app)})')
        if app not in PROJECT:
            rows.append((label or '?', url[-14:], bot, 'SKIPPED', '; '.join(note) or 'unknown app'))
            continue
        if not st.get('ownSheet') and not st.get('error'):
            note.append('run install() (own sheet missing)')
        if st.get('next') and st['next'] != 'Ready.':
            note.append('Apps Script says: ' + st['next'])
        status = 'checked'
        if not dry:
            ok, err = cf_set_env(PROJECT[app], {'GAS_URL': url, 'APP_ID': app})
            write_config(app, url, bot)
            status = ('deployed' if deploy(app) else 'DEPLOY FAILED') if ok else 'CLOUDFLARE ERROR ' + str(err)
        rows.append((NAMES.get(app, app), PROJECT[app], '@' + bot if bot else '(no bot name)', status, '; '.join(note) or 'Ready'))
    w = [max(len(str(r[i])) for r in rows) for i in range(5)]
    for r in rows:
        print('  '.join(str(c).ljust(w[i]) for i, c in enumerate(r)))


if __name__ == '__main__':
    main()
