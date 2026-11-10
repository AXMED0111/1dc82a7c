"""Builds single-file apps from templates, injecting the shared design system and kit.
%%STYLE%% + %%ICONS%% come from apps/converter/public/index.html (the reference design);
%%EXTRA%% = shared/extra.css + shared/icons-extra.svg ; %%KIT%% = shared/kit.js
Usage: python3 tools/build.py rsvp debt ...   (no args = all apps with a src/ template)"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
base = (root / 'apps/converter/public/index.html').read_text()
style = re.search(r'<style>.*?</style>', base, re.S).group(0)
icons = re.search(r'<svg width="0".*?</svg>', base, re.S).group(0)
extra = (root / 'shared/extra.css').read_text() + (root / 'shared/icons-extra.svg').read_text()
kit = (root / 'shared/kit.js').read_text()
import json
ABOUT = json.loads((root / 'shared/about.json').read_text())
apps = sys.argv[1:] or [p.parent.parent.name for p in root.glob('apps/*/src/app.template.html')]
for app in apps:
    src = (root / f'apps/{app}/src/app.template.html').read_text()
    about = '<script>window.APP_ABOUT=' + json.dumps(ABOUT.get(app, {}), ensure_ascii=False) + ';</script>\n'
    out = src.replace('%%STYLE%%', style).replace('%%ICONS%%', icons).replace('%%EXTRA%%', extra).replace('%%KIT%%', about + '<script>\n' + kit + '\n</script>')
    dst = root / f'apps/{app}/public/index.html'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(out)
    print('built', dst.relative_to(root), len(out) // 1024, 'KB')

# Cloudflare Pages Function: secret-free forwarder (Apps Script verifies Telegram's secret header itself)
CF = (root / 'shared/telegram-forwarder.js').read_text()
EDGE = (root / 'shared/edge-proxy.js').read_text()   # edge copy in front of Apps Script: /api/app
ENGINE = (root / 'shared/worker/engine.js').read_text()   # D1 engine (docs/D1-MIGRATION.md)
WRAP = {   # Pages Functions for apps that have a D1 module: Cloudflare variable BACKEND=d1 switches the app to D1
  'app.js': "import { createApp } from '../../lib/engine.js';\nimport MOD from '../../lib/module.js';\nimport { onRequestPost as viaGoogle } from '../../lib/edge.js';\nconst D1 = createApp(MOD);\n// BACKEND=d1: answer from this app's D1 database; otherwise the edge copy in front of Apps Script.\nexport const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? D1.app(c) : viaGoogle(c));\n",
  'telegram.js': "import { createApp } from '../../lib/engine.js';\nimport MOD from '../../lib/module.js';\nimport { onRequest as toGoogle } from '../../lib/forwarder.js';\nconst D1 = createApp(MOD);\nexport const onRequest = (c) => (c.env.BACKEND === 'd1' && c.request.method === 'POST' ? D1.telegram(c) : toGoogle(c));\n",
  'cron.js': "import { createApp } from '../../lib/engine.js';\nimport MOD from '../../lib/module.js';\nconst D1 = createApp(MOD);\n// Called every 5 minutes by the axm-cron Worker (header x-cron-key).\nexport const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? D1.cron(c) : new Response('{\"ok\":true,\"skipped\":\"backend is Google\"}'));\n",
  'file.js': "import { createApp } from '../../lib/engine.js';\nimport MOD from '../../lib/module.js';\nconst D1 = createApp(MOD);\n// Raw-byte uploads (converted files, PDF reports) sent on to the user's Telegram chat; GET = a private picture by signed link.\nexport const onRequest = (c) => (c.env.BACKEND === 'd1' && /^(GET|POST)$/.test(c.request.method) ? D1.file(c) : new Response('{\"ok\":false,\"error\":\"not_configured\"}'));\n",
  'migrate.js': "import { createApp } from '../../lib/engine.js';\nimport MOD from '../../lib/module.js';\nconst D1 = createApp(MOD);\n// Apps Script migrateToCloudflare() posts each tab here, signed with the webhook secret (works before the switch).\nconst out = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });\n// Once the app runs on D1 a new copy is refused (it would replace newer data with the old sheet). GET tells Apps Script which system serves the app.\nexport const onRequestPost = (c) => (c.env.BACKEND === 'd1' ? out({ ok: false, error: 'already_on_d1' }) : D1.migrate(c));\nexport const onRequestGet = (c) => out({ ok: true, backend: c.env.BACKEND === 'd1' ? 'd1' : 'gas' });\n",
  'export.js': "import { createApp } from '../../lib/engine.js';\nimport MOD from '../../lib/module.js';\nconst D1 = createApp(MOD);\n// Nightly backup (Control Center Apps Script) reads every table here, signed.\nexport const onRequestGet = (c) => D1.exportRows(c);\n",
}
for d in (root / 'apps').iterdir():
    if (d / 'public').is_dir():
        (d / 'functions/api').mkdir(parents=True, exist_ok=True)
        mod = d / 'worker' / (d.name + '.js')
        if mod.exists():
            (d / 'lib').mkdir(exist_ok=True)
            (d / 'lib/engine.js').write_text(ENGINE); (d / 'lib/module.js').write_text(mod.read_text())
            (d / 'lib/edge.js').write_text(EDGE); (d / 'lib/forwarder.js').write_text(CF)
            for f, src in WRAP.items(): (d / 'functions/api' / f).write_text(src)
        else:
            (d / 'functions/api/telegram.js').write_text(CF)
            (d / 'functions/api/app.js').write_text(EDGE)
print('Cloudflare functions written (D1 engine where a module exists)')

# English bot descriptions into each app's Apps Script module (block between markers is regenerated)
import re as _re
MOD = {'control': 'Control.gs', 'gatekeeper': 'Gatekeeper.gs', 'coach': 'Coach.gs', 'translator': 'Translator.gs', 'rsvp': 'Rsvp.gs', 'scholar': 'Scholar.gs', 'debt': 'Debt.gs', 'market': 'Market.gs', 'converter': 'Converter.gs'}
for app, f in MOD.items():
    p = root / 'apps' / app / 'apps-script' / f
    s = p.read_text()
    block = '/* ABOUT — generated by tools/build.py from shared/about.json (bot description shown before Start) */\nvar APP_ABOUT = ' + json.dumps({'short': ABOUT[app]['short'], 'long': ABOUT[app]['long']}, ensure_ascii=False) + ';\n/* END ABOUT */\n'
    s = _re.sub(r'/\* ABOUT — generated.*?/\* END ABOUT \*/\n', '', s, flags=_re.S)
    p.write_text(s.rstrip('\n') + '\n\n' + block)
print('bot descriptions written into Apps Script modules')

# PDF Tools (reference app, not templated): refresh its embedded APP_ABOUT
_cp = root / 'apps/converter/public/index.html'; _c = _cp.read_text()
_c = _re.sub(r'<!--ABOUT-->.*?<!--/ABOUT-->', '<!--ABOUT--><script>window.APP_ABOUT=' + json.dumps(ABOUT['converter'], ensure_ascii=False).replace('\\', '\\\\') + ';</script><!--/ABOUT-->', _c, flags=_re.S)
_cp.write_text(_c)
