"""
Génère les éléments de marque Podsal à partir du logo fourni (brand/branding.pdf, export Canva) :
logo recadré, favicon, icônes web, icônes et écrans de démarrage Android / iOS, composant React du mot-symbole.

    pip install pymupdf
    python3 brand/generate.py
"""
import glob, os, re
import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEAL = '#2f4f4f'
CREAM = '#f5f1ec'

page = pymupdf.open(f'{ROOT}/brand/branding.pdf')[0]
s = page.get_svg_image(text_as_path=True)
defs = dict(re.findall(r'<path id="(font_[^"]+)" d="([^"]+)"', s))
uses = re.findall(r'<use data-text="(.)" xlink:href="#(font_[^"]+)" transform="matrix\(([^)]+)\)"', s)


def ink_box(only=None, scale=12):
    """Boîte englobante réelle des glyphes, mesurée sur un rendu (les courbes débordent de leurs points)."""
    body = ''.join(f'<path d="{defs[g]}" transform="matrix({m})"/>' for ch, g, m in uses if only is None or ch in only)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {page.rect.width} {page.rect.height}"><g fill="#000">{body}</g></svg>'
    pix = pymupdf.open(stream=svg.encode(), filetype='svg')[0].get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=True)
    w, h, n, a = pix.width, pix.height, pix.n, pix.samples
    xs, ys = [], []
    for y in range(h):
        row = a[y * w * n:(y + 1) * w * n]
        for x in range(w):
            if row[x * n + n - 1] > 8:
                xs.append(x)
                ys.append(y)
    return min(xs) / scale, min(ys) / scale, (max(xs) + 1) / scale, (max(ys) + 1) / scale


bb = {'full': ink_box(), 'P': ink_box('P')}
FX0, FY0, FX1, FY1 = bb['full']


def fmt(v):
    return f'{v:.3f}'.rstrip('0').rstrip('.')


def glyph_paths(only=None, fill=None):
    fill_attr = f' fill="{fill}"' if fill else ''
    return ''.join(f'<path{fill_attr} transform="matrix({m})" d="{defs[g]}"/>' for ch, g, m in uses if only is None or ch in only)


def placed(box, target_x, target_y, target_w, only=None):
    """Glyphes mis à l'échelle pour que la boîte `box` occupe target_w de large à (target_x, target_y)."""
    x0, y0, x1, y1 = box
    k = target_w / (x1 - x0)
    return f'<g fill="{CREAM}" transform="translate({fmt(target_x)} {fmt(target_y)}) scale({fmt(k)}) translate({fmt(-x0)} {fmt(-y0)})">{glyph_paths(only)}</g>', k * (y1 - y0)


def square_svg(size, text_ratio, rounded=0, only=None, box=None, bg=TEAL):
    box = box or bb['full']
    w = size * text_ratio
    k = w / (box[2] - box[0])
    h = k * (box[3] - box[1])
    g, _ = placed(box, (size - w) / 2, (size - h) / 2, w, only)
    rect = f'<rect width="{size}" height="{size}" rx="{rounded}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">{rect}{g}</svg>'


def rect_svg(w, h, text_ratio, bg=TEAL):
    tw = min(w, h * 4) * text_ratio
    k = tw / (FX1 - FX0)
    th = k * (FY1 - FY0)
    g, _ = placed(bb['full'], (w - tw) / 2, (h - th) / 2, tw)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><rect width="{w}" height="{h}" fill="{bg}"/>{g}</svg>'


def circle_svg(size, text_ratio):
    w = size * text_ratio
    k = w / (FX1 - FX0)
    h = k * (FY1 - FY0)
    g, _ = placed(bb['full'], (size - w) / 2, (size - h) / 2, w)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}"><circle cx="{size/2}" cy="{size/2}" r="{size/2}" fill="{TEAL}"/>{g}</svg>'


def png(svg, path, alpha=True):
    doc = pymupdf.open(stream=svg.encode(), filetype='svg')
    pix = doc[0].get_pixmap(alpha=alpha)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pix.save(path)


# 1. Logo complet (bloc vert-bleu + mot-symbole), recadré : marges régulières, angles de 6 px.
pad_x, pad_y = 14, 10
lw, lh = (FX1 - FX0) + 2 * pad_x, (FY1 - FY0) + 2 * pad_y
logo = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(lw)} {fmt(lh)}">'
        f'<rect width="{fmt(lw)}" height="{fmt(lh)}" rx="6" fill="{TEAL}"/>'
        f'<g fill="{CREAM}" transform="translate({fmt(pad_x - FX0)} {fmt(pad_y - FY0)})">{glyph_paths()}</g></svg>')
open(f'{ROOT}/public/logo.svg', 'w').write(logo)

# 2. Favicon : initiale « P » de la même police.
open(f'{ROOT}/public/favicon.svg', 'w').write(square_svg(64, 0.36, rounded=12, only='P', box=bb['P']).replace(' width="64" height="64"', '', 1))

# 3. Icônes de l'application web (le système applique son propre masque).
for size in (192, 512):
    png(square_svg(size, 0.66), f'{ROOT}/public/icons/icon-{size}.png', alpha=False)
png(square_svg(180, 0.7), f'{ROOT}/public/icons/apple-touch-icon.png', alpha=False)

# 4. Android : icônes classiques, rondes et premier plan des icônes adaptatives.
dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
res = f'{ROOT}/android/app/src/main/res'
for d, size in dens.items():
    png(square_svg(size, 0.7, rounded=size * 0.12), f'{res}/mipmap-{d}/ic_launcher.png')
    png(circle_svg(size, 0.66), f'{res}/mipmap-{d}/ic_launcher_round.png')
    fg = size * 108 // 48
    png(square_svg(fg, 0.46, bg=None), f'{res}/mipmap-{d}/ic_launcher_foreground.png')
open(f'{res}/values/ic_launcher_background.xml', 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2F4F4F</color>\n</resources>')

# Écrans de démarrage Android.
for f in glob.glob(f'{res}/drawable*/splash.png'):
    p = pymupdf.Pixmap(f)
    png(rect_svg(p.width, p.height, 0.4), f, alpha=False)

# 5. iOS : icône 1024 (sans transparence) et écran de démarrage.
ios = f'{ROOT}/ios/App/App/Assets.xcassets'
png(square_svg(1024, 0.7), f'{ios}/AppIcon.appiconset/AppIcon-512@2x.png', alpha=False)
for f in glob.glob(f'{ios}/Splash.imageset/*.png'):
    png(rect_svg(2732, 2732, 0.32), f, alpha=False)

# 6. Composant React : mot-symbole en couleur courante.
paths = ''.join(f'    <path transform="matrix({m})" d="{defs[g]}" />\n' for ch, g, m in uses)
tsx = f'''/**
 * Mot-symbole « Podsal » (logo fourni, Branding.pdf), vectorisé.
 * Il prend la couleur du texte : on le pose sur un bloc vert-bleu pour retrouver le logo complet.
 */
export function Wordmark({{ className, title = 'Podsal' }}: {{ className?: string; title?: string }}) {{
  return (
    <svg className={{className}} viewBox="{fmt(FX0)} {fmt(FY0)} {fmt(FX1 - FX0)} {fmt(FY1 - FY0)}" fill="currentColor" role="img" aria-label={{title}}>
{paths}    </svg>
  );
}}
'''
open(f'{ROOT}/src/components/Wordmark.tsx', 'w').write(tsx)
print('ok', fmt(lw), fmt(lh))
