"""L11 audit for S186 (Browse) and S187 (Home hero sound control).

Run: python3 l11-audit.py <docs/mockups/v2/L11 dir>
Needs python playwright and PIL. Prints one line per check. Nothing here changes a file.
It measures: dashes and emojis, raw colours outside the token block, targets under 44 px,
horizontal overflow at 390 and 360, token contrast pairs, and the contrast of white hero text
on the real art (text hidden, lightest pixel behind each text box sampled from a screenshot).
"""
import re, sys, io, glob, os
from playwright.sync_api import sync_playwright
from PIL import Image

D = sys.argv[1]
FILES = sorted(glob.glob(os.path.join(D, 'S18[67]_*.dc.html')))


def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def blend(fg, a, bg):
    return tuple(round(fg[i] * a + bg[i] * (1 - a)) for i in range(3))


print('== static checks')
for f in FILES:
    s = open(f, encoding='utf-8').read()
    name = os.path.basename(f)
    dashes = len(re.findall('[–—]', s))
    emoji = len(re.findall('[\U0001F300-\U0001FAFF☀-➿]', s))
    body = re.sub(r'<svg.*?</svg>', '', s, flags=re.S)
    body = re.sub(r':root\{.*?\n\}', '', body, flags=re.S)
    # the theme test frames set their own variables on purpose
    body = re.sub(r'style="[^"]*--color-bg[^"]*"', '', body)
    raw = re.findall(r'#[0-9a-fA-F]{3,8}\b|(?<![-\w])rgba?\((?!var)[^)]*\)', body)
    raw = [r for r in raw if not r.startswith('rgba(var(')]
    fonts = len(re.findall(r'font-family:(?!var\()', body.split('</style>')[1])) + len(re.findall(r'font-family:(?!var\()[^;]*', body.split('<style>')[1].split('</style>')[0]))
    outline_none = len(re.findall(r'outline:\s*(none|0)\b', body))
    print(f'{name}: dashes={dashes} emoji={emoji} raw_colours_outside_tokens={len(raw)} {sorted(set(raw))[:6]} outline_none={outline_none} (replaced by ring on child: see review)')

print('== token contrast (default theme)')
bg, surface, ink, muted = map(hexrgb, ('#F5F5F2', '#FFFFFF', '#1A1C22', '#5B606B'))
primary, hover, tint, info_ink = map(hexrgb, ('#1F6FB5', '#1B5F9C', '#E3F1FF', '#14568F'))
strong, sunken, accent = map(hexrgb, ('#8A8D94', '#ECEAE3', '#FFC93C'))
player = hexrgb('#0E0F13')
pairs = [
    ('ink on bg', ink, bg, 4.5), ('muted on bg (count)', muted, bg, 4.5), ('muted on surface (meta)', muted, surface, 4.5),
    ('white on primary (selected chip)', (255, 255, 255), primary, 4.5), ('white on primary-hover', (255, 255, 255), hover, 4.5),
    ('primary link on bg (Clear)', primary, bg, 4.5), ('info-ink on tint (set menu button)', info_ink, tint, 4.5),
    ('ink on tint (selected menu row)', ink, tint, 4.5), ('muted on sunken (disabled loading button)', muted, sunken, 4.5),
    ('border-strong on bg (chip and menu button edge)', strong, bg, 3.0), ('border-strong on surface', strong, surface, 3.0),
    ('focus ring primary on bg', primary, bg, 3.0), ('focus ring primary on tint', primary, tint, 3.0),
    ('focus ring dark (accent) on player bg', accent, player, 3.0),
]
for n, a, b, need in pairs:
    r = ratio(a, b)
    print(f'{n}: {r:.2f}:1 need {need} {"PASS" if r >= need else "FAIL"}')

print('== image overlays (worst case: lightest poster pixel F1EBDC)')
pale = hexrgb('#F1EBDC')
dur_bg = blend(player and (14, 15, 19), 0.72, pale)
print(f'duration badge white on 0.72 scrim over pale: {ratio((255, 255, 255), dur_bg):.2f}:1')
print(f'caption chip and My List dot: icon white on the same fill: {ratio((255, 255, 255), dur_bg):.2f}:1')
print(f'My List dot edge vs poster (non text, dot on pale): {ratio(dur_bg, pale):.2f}:1')
track_bg = blend((14, 15, 19), 0.85, pale)
trk = blend((255, 255, 255), 0.4, track_bg)
print(f'hero track (white .4) vs scrim over pale: {ratio(trk, track_bg):.2f}:1 need 3.0')
print(f'hero accent fill vs track: {ratio(accent, trk):.2f}:1 need 3.0')
print(f'hero accent fill vs scrim over pale: {ratio(accent, track_bg):.2f}:1')
chip = blend((14, 15, 19), 0.6, pale)
print(f'hero pill white text on 0.6 chip over pure pale: {ratio((255, 255, 255), chip):.2f}:1 (token note says 5.03 over white)')
print(f'hero pill border white .85 vs chip over pale: {ratio(blend((255, 255, 255), .85, chip), chip):.2f}:1 need 3.0')
print(f'hero pill border vs scrim over pale: {ratio(blend((255, 255, 255), .85, track_bg), track_bg):.2f}:1')
print(f'white text under the 0.88 left scrim over pale: {ratio((255, 255, 255), blend((14, 15, 19), .88, pale)):.2f}:1 need 4.5')
print(f'white text at mobile hold 0.85 over pale: {ratio((255, 255, 255), blend((14, 15, 19), .85, pale)):.2f}:1 need 4.5')
print(f'white text at mobile mid 0.70 over pale: {ratio((255, 255, 255), blend((14, 15, 19), .70, pale)):.2f}:1')

print('== theme test pairs (dark ink on lemon, S186 state 12)')
lbg, lprim, lhov, ltint, lstrong, lmuted, linfo = map(hexrgb, ('#FFF8DC', '#6B4200', '#573500', '#FBE7B0', '#7A6A3A', '#5A4F2C', '#4D3000'))
for n, a, b, need in [('ink on lemon', ink, lbg, 4.5), ('muted on lemon', lmuted, lbg, 4.5), ('white on primary', (255, 255, 255), lprim, 4.5),
                      ('info-ink on tint', linfo, ltint, 4.5), ('primary link on lemon (Clear)', lprim, lbg, 4.5),
                      ('border-strong on lemon', lstrong, lbg, 3.0), ('border-strong on surface', lstrong, surface, 3.0)]:
    r = ratio(a, b)
    print(f'{n}: {r:.2f}:1 need {need} {"PASS" if r >= need else "FAIL"}')

TARGET_JS = """() => {
  const out = [];
  const sel = 'a[href], button, [role=menuitemradio], [role=radio]';
  document.querySelectorAll(sel).forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (e.closest('.ad-sr-only')) return;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') return;
    if (r.width < 43.5 || r.height < 43.5) out.push((e.className || e.tagName) + ' ' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  return [...new Set(out)];
}"""

GAP_JS = """() => {
  // neighbours inside a control group closer than 8 px
  const bad = [];
  document.querySelectorAll('.cluster, .segs, .rail__scroller, .bar, .hc .acts').forEach(g => {
    const kids = [...g.children].filter(k => k.getBoundingClientRect().width > 0 && getComputedStyle(k).visibility !== 'hidden');
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
      const gap = b.left - a.right;
      const vis = (el) => { const v = el.querySelector('.chip, .track'); return v ? v.getBoundingClientRect() : el.getBoundingClientRect(); };
      const va = vis(kids[i - 1]), vb = vis(kids[i]);
      if (Math.abs(b.top - a.top) < 4 && Math.min(gap, vb.left - va.right) < 7.5) bad.push(g.className + ' gap ' + gap.toFixed(1));
    }
  });
  return [...new Set(bad)];
}"""

OVER_JS = """(W) => {
  document.querySelectorAll('.m, .m .win, .m .hero').forEach(e => { e.style.width = W + 'px'; });
  const bad = [];
  document.querySelectorAll('body *').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right <= W + 1 && r.left >= -1) return;
    let a = e.parentElement, clipped = false;
    while (a && a !== document.body) {
      const o = getComputedStyle(a);
      if (/(hidden|auto|scroll|clip)/.test(o.overflowX) && a.getBoundingClientRect().right <= W + 1) { clipped = true; break; }
      a = a.parentElement;
    }
    if (!clipped && !['svg', 'path', 'circle', 'rect', 'g', 'defs', 'lineargradient', 'radialgradient', 'stop', 'filter', 'fegaussianblur'].includes(e.tagName.toLowerCase()))
      bad.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  return [...new Set(bad)].slice(0, 6);
}"""

HERO_TEXT_JS = """() => {
  // hide text, keep boxes; report boxes of white text on the hero
  const boxes = [];
  document.querySelectorAll('.hero').forEach((h, hi) => {
    h.querySelectorAll('h2, p, .meta span, .hbtn, .hpill span, .hnav .links a').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.width && r.height) boxes.push({hi, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, t: (e.textContent || '').trim().slice(0, 28)});
    });
  });
  document.querySelectorAll('.hero *').forEach(e => { e.style.setProperty('color', 'transparent', 'important'); });
  document.querySelectorAll('.hero svg').forEach(e => { e.style.setProperty('color', 'transparent'); });
  return boxes;
}"""

print('== targets, spacing, overflow')
with sync_playwright() as p:
    b = p.chromium.launch()
    for f in FILES:
        name = os.path.basename(f)
        W = 390 if name.endswith('_m.dc.html') else 1360
        pg = b.new_page(viewport={'width': W, 'height': 900})
        pg.goto('file://' + f)
        pg.wait_for_timeout(300)
        small = pg.evaluate(TARGET_JS)
        gaps = pg.evaluate(GAP_JS)
        print(f'{name} @{W}: targets under 44: {len(small)} {small[:5]}; neighbours under 8 px: {gaps[:4]}')
        if W == 390:
            pg.set_viewport_size({'width': 360, 'height': 900})
            print(f'{name} @360 overflow: {pg.evaluate(OVER_JS, 360)}')
        pg.close()

    print('== hero text contrast on the real art (text hidden, lightest pixel in each text box)')
    for f in [x for x in FILES if 'hero' in x]:
        name = os.path.basename(f)
        W = 390 if name.endswith('_m.dc.html') else 1360
        pg = b.new_page(viewport={'width': W, 'height': 900})
        pg.goto('file://' + f)
        pg.wait_for_timeout(300)
        boxes = pg.evaluate(HERO_TEXT_JS)
        pg.wait_for_timeout(100)
        png = pg.screenshot(full_page=True)
        im = Image.open(io.BytesIO(png)).convert('RGB')
        worst = {}
        for bx in boxes:
            if bx['hi'] != 0:
                continue  # first hero is the default state, others share the same art and scrims
            x0, y0 = int(bx['x']), int(bx['y'])
            crop = im.crop((x0 + 4, y0 + 4, x0 + int(bx['w']) - 4, y0 + int(bx['h']) - 4))  # inset: skip the white borders
            mx = max(crop.get_flattened_data() if hasattr(crop, 'get_flattened_data') else crop.getdata(), key=lum)
            r = ratio((255, 255, 255), mx)
            worst[bx['t']] = r
        for t, r in sorted(worst.items(), key=lambda kv: kv[1])[:6]:
            print(f'{name}: "{t}" white on lightest pixel behind it: {r:.2f}:1 need 4.5 {"PASS" if r >= 4.5 else "FAIL"}')
        pg.close()
    b.close()
