"""Globe geometry for Atlas Economics from Natural Earth 1:110m (public domain):
land as points on a Fibonacci sphere that fall on land, and a label point per country (ISO3)."""
import json, math, sys
NE = '/home/claude/vendor-src/ne/geojson/'
land = json.load(open(NE + 'ne_110m_land.geojson'))
rings = []
for f in land['features']:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for p in polys:
        outer = p[0]
        xs = [q[0] for q in outer]; ys = [q[1] for q in outer]
        rings.append((outer, min(xs), max(xs), min(ys), max(ys), p[1:]))
def inside(ring, x, y):
    c = False; n = len(ring); j = n - 1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi: c = not c
        j = i
    return c
def on_land(lon, lat):
    for outer, x0, x1, y0, y1, holes in rings:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and inside(outer, lon, lat):
            if any(inside(h, lon, lat) for h in holes): return False
            return True
    return False
N = int(sys.argv[1]) if len(sys.argv) > 1 else 42000
golden = math.pi * (3 - math.sqrt(5))
pts = []
for i in range(N):
    y = 1 - (i + 0.5) / N * 2; r = math.sqrt(1 - y * y); th = golden * i
    lat = math.degrees(math.asin(y)); lon = math.degrees(math.atan2(r * math.sin(th), r * math.cos(th)))
    if lat < -60: continue            # skip Antarctica: no economies there and it dominates the bottom view
    if on_land(lon, lat): pts.append((round(lat, 2), round(lon, 2)))
cty = json.load(open(NE + 'ne_110m_admin_0_countries.geojson'))
cent = {}
for f in cty['features']:
    p = f['properties']
    iso = next((p.get(k) for k in ('ISO_A3', 'ISO_A3_EH', 'ADM0_A3') if p.get(k) and p.get(k) != '-99'), None)
    if not iso: continue
    lx, ly = p.get('LABEL_X'), p.get('LABEL_Y')
    if lx is None: continue
    cent[iso] = [round(ly, 2), round(lx, 2)]
fix = {'KOS': 'XKX'}
for a, b in fix.items():
    if a in cent and b not in cent: cent[b] = cent.pop(a)
flat = [v for p in pts for v in p]
out = {'land': flat, 'cent': cent, 'src': 'Natural Earth 1:110m (public domain)', 'n': len(pts)}
json.dump(out, open('/home/claude/fx3d/geo/globe-geo.json', 'w'), separators=(',', ':'))
print('land points', len(pts), 'countries', len(cent))
