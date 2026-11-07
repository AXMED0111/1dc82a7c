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
apps = sys.argv[1:] or [p.parent.parent.name for p in root.glob('apps/*/src/app.template.html')]
for app in apps:
    src = (root / f'apps/{app}/src/app.template.html').read_text()
    out = src.replace('%%STYLE%%', style).replace('%%ICONS%%', icons).replace('%%EXTRA%%', extra).replace('%%KIT%%', '<script>\n' + kit + '\n</script>')
    dst = root / f'apps/{app}/public/index.html'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(out)
    print('built', dst.relative_to(root), len(out) // 1024, 'KB')

# Cloudflare Pages copy of the bot webhook (free hosting, no credits): functions/api/telegram.js in every app,
# generated from the Netlify version so both stay identical. Same URL path: /api/telegram
src = (root / 'apps/converter/netlify/functions/telegram.mjs').read_text()
cf = src.replace("const env = (k) => (globalThis.Netlify ? Netlify.env.get(k) : process.env[k]) || '';",
                 "let ENV = {};\nconst env = (k) => ENV[k] || '';  // Cloudflare: Settings → Variables and Secrets")
cf = cf.replace("export default async (req) => {", "async function handle(req) {")
cf = cf.replace("};\n\nexport const config = { path: '/api/telegram' };", "}\n\n// Cloudflare Pages Function entry point\nexport async function onRequest(context) { ENV = context.env || {}; return handle(context.request); }")
cf = cf.replace("Secrets come ONLY from Netlify environment variables", "Secrets come ONLY from Cloudflare Pages environment variables (Settings → Variables and Secrets)")
assert 'onRequest' in cf and 'export default' not in cf
for d in (root / 'apps').iterdir():
    if (d / 'public').is_dir():
        (d / 'functions/api').mkdir(parents=True, exist_ok=True)
        (d / 'functions/api/telegram.js').write_text(cf)
        (d / 'netlify/functions').mkdir(parents=True, exist_ok=True)
        (d / 'netlify/functions/telegram.mjs').write_text(src)
print('webhook: Netlify + Cloudflare copies written')
