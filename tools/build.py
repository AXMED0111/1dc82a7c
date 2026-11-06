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
