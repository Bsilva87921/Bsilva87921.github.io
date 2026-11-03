"""App icons for the two Probable apps (drawn here, no external art).
Sports Lab: a game orb split between two team colors by win probability (the arena's own mark).
Atlas: a lit globe with graticule and one data spike."""
import math
from PIL import Image, ImageDraw, ImageFilter
OUT = '/home/claude/apps/icons/'
def radial(size, c0, c1, cx=0.5, cy=0.35, r=0.95):
    im = Image.new('RGB', (size, size), c1); px = im.load()
    for y in range(size):
        for x in range(size):
            d = min(1, math.hypot(x / size - cx, y / size - cy) / r)
            px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * d) for i in range(3))
    return im
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def orb(S, cx, cy, R, top, bot, split=0.58):
    """sphere split at the height where the top cap's area share = split (Archimedes), with shading and seam"""
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); px = layer.load()
    ycut = 1 - 2 * split
    for y in range(int(cy - R) - 1, int(cy + R) + 2):
        for x in range(int(cx - R) - 1, int(cx + R) + 2):
            dx, dy = (x - cx) / R, (y - cy) / R; rr = dx * dx + dy * dy
            if rr > 1: continue
            dz = math.sqrt(1 - rr); ny = -dy
            base = top if ny > -ycut else bot
            l = max(0, 0.35 * dx * -1 + 0.55 * ny + 0.75 * dz)
            shade = 0.38 + 0.75 * l
            spec = max(0, (-dx * 0.4 + ny * 0.6 + dz * 0.7)) ** 30 * 0.9
            seam = 1 - min(1, abs(ny + ycut) / 0.025)
            c = [min(255, int(base[i] * shade + 255 * spec + 255 * seam * 0.8)) for i in range(3)]
            edge = min(1, (1 - math.sqrt(rr)) * R / 1.5)
            px[x, y] = (*c, int(255 * edge))
    return layer
def glow(S, cx, cy, R, col, a=150, blur=0.12):
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*col, a))
    return g.filter(ImageFilter.GaussianBlur(S * blur))
def sports(size, mask=False):
    S = size * 4
    im = radial(S, hexc('#1a2d4f'), hexc('#070c18')).convert('RGBA')
    R = S * (0.27 if mask else 0.33); cx, cy = S / 2, S * 0.5
    im = Image.alpha_composite(im, glow(S, cx, cy, R * 1.25, hexc('#FFB547'), 90, 0.08))
    # floor ring (the arena's NOW line, as an ellipse)
    ring = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
    w = max(2, S // 110); d.ellipse([cx - R * 1.45, cy + R * 0.78, cx + R * 1.45, cy + R * 1.18], outline=(255, 181, 71, 200), width=w)
    im = Image.alpha_composite(im, ring.filter(ImageFilter.GaussianBlur(S / 400)))
    im = Image.alpha_composite(im, orb(S, cx, cy, R, hexc('#FFB547'), hexc('#2a78d6'), 0.58))
    return im.resize((size, size), Image.LANCZOS)
def atlas(size, mask=False):
    S = size * 4
    im = radial(S, hexc('#15414a'), hexc('#071318')).convert('RGBA')
    R = S * (0.27 if mask else 0.33); cx, cy = S / 2, S * 0.52
    im = Image.alpha_composite(im, glow(S, cx, cy, R * 1.12, hexc('#46c2b0'), 120, 0.06))
    body = Image.new('RGBA', (S, S), (0, 0, 0, 0)); px = body.load()
    for y in range(int(cy - R), int(cy + R) + 1):
        for x in range(int(cx - R), int(cx + R) + 1):
            dx, dy = (x - cx) / R, (y - cy) / R; rr = dx * dx + dy * dy
            if rr > 1: continue
            dz = math.sqrt(1 - rr); l = max(0, -0.4 * dx - 0.5 * dy + 0.75 * dz)
            rim = (1 - dz) ** 3
            c = (int(14 + 30 * l + 60 * rim), int(42 + 60 * l + 150 * rim), int(54 + 60 * l + 140 * rim))
            px[x, y] = (*c, 255)
    im = Image.alpha_composite(im, body)
    d = ImageDraw.Draw(im); w = max(2, S // 160); col = (110, 214, 196, 150)
    for k in (-60, -30, 0, 30, 60):                       # parallels
        yy = cy - R * math.sin(math.radians(k)); rx = R * math.cos(math.radians(k))
        d.ellipse([cx - rx, yy - rx * 0.16, cx + rx, yy + rx * 0.16], outline=col, width=w)
    for k in (-60, -20, 20, 60):                          # meridians
        rx = abs(R * math.sin(math.radians(k)))
        d.ellipse([cx - rx, cy - R, cx + rx, cy + R], outline=col, width=w)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(150, 235, 220, 210), width=w * 2)
    # one spike with a glowing cap (a data point)
    sx, sy = cx + R * 0.28, cy - R * 0.22
    d.line([sx, sy, sx + R * 0.32, sy - R * 0.62], fill=(255, 196, 92, 255), width=w * 3)
    im = Image.alpha_composite(im, glow(S, sx + R * 0.32, sy - R * 0.62, R * 0.09, hexc('#FFC45C'), 220, 0.01))
    d = ImageDraw.Draw(im); r = R * 0.055; d.ellipse([sx + R * 0.32 - r, sy - R * 0.62 - r, sx + R * 0.32 + r, sy - R * 0.62 + r], fill=(255, 226, 160, 255))
    return im.resize((size, size), Image.LANCZOS)
for name, fn in (('sports', sports), ('atlas', atlas)):
    for sz in (512, 192):
        fn(sz).convert('RGB').save(f'{OUT}{name}-{sz}.png', optimize=True)
    fn(512, True).convert('RGB').save(f'{OUT}{name}-maskable-512.png', optimize=True)
    fn(180).convert('RGB').save(f'{OUT}{name}-apple-180.png', optimize=True)
    fn(1024).convert('RGB').save(f'{OUT}{name}-1024.png', optimize=True)   # store listings / Capacitor source icon
print('ok')
