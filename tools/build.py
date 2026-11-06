"""Builds single-file apps from templates, injecting the shared design system
(styles + line-icon sprite) taken from apps/converter/public/index.html.
Usage: python3 tools/build.py gatekeeper"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
base = (root / 'apps/converter/public/index.html').read_text()
style = re.search(r'<style>.*?</style>', base, re.S).group(0)
icons = re.search(r'<svg width="0".*?</svg>', base, re.S).group(0)
for app in sys.argv[1:]:
    src = (root / f'apps/{app}/src/app.template.html').read_text()
    out = src.replace('%%STYLE%%', style).replace('%%ICONS%%', icons)
    dst = root / f'apps/{app}/public/index.html'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(out)
    print('built', dst.relative_to(root), len(out), 'bytes')
