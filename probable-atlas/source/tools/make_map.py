import json, math
d = json.load(open('/home/claude/atlas/data/wgj/countries.geo.json'))
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2
def proj(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    t = math.asin(M * math.sin(p)); t2 = t * t; t6 = t2 ** 3
    x = l * math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x, y
# extent
X = proj(180, 0)[0]; Y = proj(0, 90)[1]
W = 1000.0; S = W / (2 * X); H = 2 * Y * S
def pt(lon, lat):
    x, y = proj(lon, lat)
    return (x + X) * S, (Y - y) * S
def ring(r):
    pts = [pt(*c[:2]) for c in r]
    out, last = [], None
    for x, y in pts:
        q = (round(x, 1), round(y, 1))
        if q != last: out.append(q); last = q
    if len(out) < 3: return ''
    s = 'M' + ' '.join(f'{x:g} {y:g}' if i == 0 else f'{x:g} {y:g}' for i, (x, y) in enumerate(out[:1]))
    s = 'M%g %gL' % out[0] + ' '.join('%g %g' % p for p in out[1:]) + 'Z'
    return s
paths, cent = {}, {}
for f in d['features']:
    iso = f['id']
    if iso in ('ATA', '-99'): continue
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    p = ''.join(ring(r) for poly in polys for r in poly)
    # label point: centroid of largest ring (projected)
    big = max((poly[0] for poly in polys), key=len)
    xs = [pt(*c[:2]) for c in big]; cx = sum(x for x, _ in xs) / len(xs); cy = sum(y for _, y in xs) / len(xs)
    paths[iso] = p; cent[iso] = [round(cx), round(cy)]
# graticule outline (sphere)
sph = [pt(-180, la) for la in range(-90, 91, 5)] + [pt(180, la) for la in range(90, -91, -5)]
outline = 'M' + 'L'.join('%.1f %.1f' % p for p in sph) + 'Z'
js = 'const MAP=' + json.dumps({'w': W, 'h': round(H, 1), 'outline': outline, 'p': paths, 'c': cent}, separators=(',', ':')) + ';\n'
# fix: Kosovo etc
open('/home/claude/atlas/src/map-data.js', 'w').write(js)
print(len(paths), round(H,1), len(js))
