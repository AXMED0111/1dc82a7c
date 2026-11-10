"""Generates the logo family (1024x1024 SVG; Telegram shows them as circles, so artwork stays inside the circle)."""
import pathlib
OUT = pathlib.Path(__file__).parent
FONT = "Inter, 'Segoe UI', Arial, sans-serif"

def wrap(c1, c2, shadow, body, badge):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F1F3F7"/></linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="{shadow}" flood-opacity=".35"/></filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="430" fill="#ffffff" opacity=".06"/>
{body}
  <g transform="translate(700 690)"><circle r="92" fill="#ffffff"/><circle r="78" fill="#1F2A44"/>
{badge}
  </g>
</svg>'''

S = 'fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"'
LOGOS = {
 # Control Center: dashboard card with bars and trend line; badge = shield check
 'control-center': ('#4B5B73', '#0F172A', '#020617', f'''
  <g filter="url(#sh)"><rect x="268" y="290" width="470" height="420" rx="40" fill="url(#w)"/></g>
  <rect x="268" y="290" width="470" height="70" rx="40" fill="#E6E9F0"/><rect x="268" y="330" width="470" height="30" fill="#E6E9F0"/>
  <circle cx="314" cy="325" r="11" fill="#F0544F"/><circle cx="348" cy="325" r="11" fill="#F5B83D"/><circle cx="382" cy="325" r="11" fill="#2FB36C"/>
  <rect x="320" y="540" width="56" height="120" rx="12" fill="#3B5BDB"/><rect x="400" y="490" width="56" height="170" rx="12" fill="#3B5BDB" opacity=".75"/>
  <rect x="480" y="440" width="56" height="220" rx="12" fill="#3B5BDB" opacity=".5"/>
  <path d="M320 470 L410 430 L490 395 L560 410" fill="none" stroke="#F5B83D" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>''',
  f'<path d="M0 -46 L38 -32 V2 C38 28 20 44 0 52 C-20 44 -38 28 -38 2 V-32 Z" {S}/><path d="M-16 2 L-3 15 L19 -11" {S}/>'),
 # Channel Pass: ticket with keyhole; badge = lock
 'channel-pass': ('#6E73F2', '#33309A', '#1E1B4B', '''
  <g filter="url(#sh)" transform="rotate(-8 512 500)">
    <path d="M280 360 H744 a30 30 0 0 1 30 30 V450 a50 50 0 0 0 0 100 V610 a30 30 0 0 1 -30 30 H280 a30 30 0 0 1 -30 -30 V550 a50 50 0 0 0 0 -100 V390 a30 30 0 0 1 30 -30 Z" fill="url(#w)"/>
    <path d="M600 380 V620" stroke="#C9CCF5" stroke-width="10" stroke-dasharray="22 18"/>
    <circle cx="430" cy="475" r="48" fill="#4F46E5"/><path d="M412 500 L448 500 L440 570 L420 570 Z" fill="#4F46E5"/>
    <rect x="640" y="440" width="70" height="18" rx="9" fill="#4F46E5" opacity=".35"/><rect x="640" y="485" width="50" height="18" rx="9" fill="#4F46E5" opacity=".25"/>
  </g>''',
  f'<rect x="-34" y="-8" width="68" height="54" rx="12" {S}/><path d="M-20 -8 V-24 a20 20 0 0 1 40 0 V-8" {S}/>'),
 # Interview Coach: speech bubble with microphone; badge = star
 'interview-coach': ('#B26BF7', '#5B1A99', '#2E1065', '''
  <g filter="url(#sh)"><path d="M300 280 H724 a50 50 0 0 1 50 50 V600 a50 50 0 0 1 -50 50 H470 L360 740 V650 H300 a50 50 0 0 1 -50 -50 V330 a50 50 0 0 1 50 -50 Z" fill="url(#w)"/></g>
  <rect x="462" y="340" width="100" height="170" rx="50" fill="#7E22CE"/>
  <path d="M422 470 a90 90 0 0 0 180 0" fill="none" stroke="#7E22CE" stroke-width="22" stroke-linecap="round"/>
  <path d="M512 560 V600 M470 602 H554" fill="none" stroke="#7E22CE" stroke-width="22" stroke-linecap="round"/>''',
  '<path d="M0 -46 L13 -16 L45 -13 L21 8 L28 40 L0 23 L-28 40 L-21 8 L-45 -13 L-13 -16 Z" fill="#fff"/>'),
 # Document Translator: two overlapping pages "A" and "ع"; badge = swap arrows
 'document-translator': ('#1CC4B0', '#0B6B63', '#042F2E', f'''
  <g filter="url(#sh)"><rect x="250" y="270" width="320" height="400" rx="34" fill="#CFF5EF"/></g>
  <text x="410" y="530" text-anchor="middle" font-family="{FONT}" font-weight="800" font-size="210" fill="#0F766E">A</text>
  <g filter="url(#sh)"><rect x="460" y="360" width="320" height="400" rx="34" fill="url(#w)"/></g>
  <rect x="510" y="440" width="220" height="22" rx="11" fill="#0F766E"/><rect x="510" y="490" width="180" height="22" rx="11" fill="#0F766E" opacity=".6"/>
  <rect x="510" y="540" width="210" height="22" rx="11" fill="#0F766E" opacity=".6"/><rect x="510" y="590" width="140" height="22" rx="11" fill="#0F766E" opacity=".6"/>
  <rect x="510" y="660" width="100" height="22" rx="11" fill="#0F766E" opacity=".35"/>''',
  f'<path d="M-36 -18 H34 M18 -34 L34 -18 L18 -2" {S}/><path d="M36 20 H-34 M-18 4 L-34 20 L-18 36" {S}/>'),
 # Scholarship Finder: graduation cap over a book; badge = magnifier
 'scholarship-finder': ('#45C3F7', '#075985', '#082F49', '''
  <g filter="url(#sh)">
    <path d="M512 280 L800 410 L512 540 L224 410 Z" fill="url(#w)"/>
    <path d="M340 470 V590 C340 640 684 640 684 590 V470 L512 548 Z" fill="#E8EEF6"/>
  </g>
  <path d="M512 410 L740 450 V560" fill="none" stroke="#0369A1" stroke-width="16" stroke-linecap="round"/><circle cx="740" cy="575" r="22" fill="#0369A1"/>
  <g filter="url(#sh)"><path d="M300 660 C380 630 460 640 512 680 C564 640 644 630 724 660 V760 C644 730 564 740 512 780 C460 740 380 730 300 760 Z" fill="url(#w)"/></g>
  <path d="M512 680 V780" stroke="#BFD3E6" stroke-width="10"/>''',
  f'<circle cx="-8" cy="-8" r="28" {S}/><path d="M13 13 L38 38" {S}/>'),
 # Debt Book: ledger with coin; badge = plus/minus
 'debt-book': ('#2FCB6A', '#11743A', '#052E16', f'''
  <g filter="url(#sh)"><rect x="290" y="260" width="420" height="500" rx="36" fill="url(#w)"/></g>
  <rect x="290" y="260" width="70" height="500" rx="36" fill="#16A34A"/><rect x="330" y="260" width="30" height="500" fill="#16A34A"/>
  <rect x="410" y="330" width="240" height="20" rx="10" fill="#16A34A" opacity=".35"/><rect x="410" y="380" width="190" height="20" rx="10" fill="#16A34A" opacity=".22"/>
  <rect x="410" y="430" width="220" height="20" rx="10" fill="#16A34A" opacity=".22"/>
  <circle cx="530" cy="590" r="92" fill="#F5B83D"/><circle cx="530" cy="590" r="72" fill="none" stroke="#fff" stroke-width="10" opacity=".7"/>
  <text x="530" y="632" text-anchor="middle" font-family="{FONT}" font-weight="800" font-size="120" fill="#fff">$</text>''',
  f'<path d="M-36 0 H-6 M-21 -15 V15" {S}/><path d="M8 0 H38" {S}/>'),
 # Field Tasks: clipboard with checklist and photo; badge = camera
 'field-tasks': ('#FB9A4B', '#C2410C', '#431407', '''
  <g filter="url(#sh)"><rect x="290" y="280" width="420" height="490" rx="40" fill="url(#w)"/></g>
  <rect x="420" y="245" width="160" height="80" rx="24" fill="#EA580C"/><circle cx="500" cy="270" r="12" fill="#fff"/>
  <path d="M350 400 L375 425 L415 380" fill="none" stroke="#EA580C" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="450" y="392" width="200" height="22" rx="11" fill="#EA580C" opacity=".3"/>
  <path d="M350 500 L375 525 L415 480" fill="none" stroke="#EA580C" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="450" y="492" width="160" height="22" rx="11" fill="#EA580C" opacity=".3"/>
  <rect x="350" y="580" width="60" height="60" rx="14" fill="none" stroke="#EA580C" stroke-width="14" opacity=".5"/>
  <rect x="450" y="597" width="120" height="22" rx="11" fill="#EA580C" opacity=".2"/>''',
  f'<rect x="-40" y="-22" width="80" height="58" rx="12" {S}/><path d="M-16 -22 L-8 -36 H8 L16 -22" {S}/><circle cx="0" cy="7" r="15" {S}/>'),
}
# Invitations has its own premium design (card with QR + envelope + gold seal, burgundy): brand/invitations-logo.svg, options in brand/invitations-options/
for name, (c1, c2, sh, body, badge) in LOGOS.items():
    (OUT / f'{name}-logo.svg').write_text(wrap(c1, c2, sh, body, badge))
print('written', len(LOGOS))
