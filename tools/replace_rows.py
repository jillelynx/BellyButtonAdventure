"""Swap new animation rows into Liev's pixel sprite sheet.

Takes a sheet with rows of 8 frames (for example walk + run), cuts each figure
out, scales it to the same height as Liev's existing frames, uses the same
color palette, lines the feet up on the same ground line, and writes the frames
into the chosen rows of assets/sprites/liev_retro.png.

Usage:
  python3 tools/replace_rows.py tools/liev_retro_walk_run_source.png 1,5
  (row numbers start at 0: 1 = walk, 5 = run)
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC, ROWS = sys.argv[1], [int(r) for r in sys.argv[2].split(',')]
ATLAS = sys.argv[3] if len(sys.argv) > 3 else 'assets/sprites/liev_retro'
man = json.load(open(ATLAS + '.json'))
CW, CH = man['cell']; OX, BASE = man['origin']
atlas = Image.open(ATLAS + '.png').convert('RGBA')

# Height of Liev's existing idle frames = the size new frames must match.
A = np.array(atlas)[..., 3] > 0
idle_h = np.median([np.ptp(np.where(A[0:CH, c * CW:(c + 1) * CW].any(1))[0]) + 1 for c in range(8)])

im = Image.open(SRC).convert('RGBA'); a = np.array(im); solid = a[..., 3] > 100
labels, n = ndimage.label(solid)
# Split figures that touch each other (side by side or stacked).
for _ in range(4):
    objs = ndimage.find_objects(labels)
    areas = [int((labels[sl] == i + 1).sum()) if sl else 0 for i, sl in enumerate(objs)]
    med = np.median([x for x in areas if x > 2000]); changed = False
    for i, sl in enumerate(objs):
        if not sl or areas[i] < med * 1.6: continue
        m = labels[sl] == i + 1; h, w = m.shape
        axis = 0 if h > w * 1.4 else 1
        prof = m.sum(1 - axis); lo, hi = int(len(prof) * 0.3), int(len(prof) * 0.7); cut = lo + int(np.argmin(prof[lo:hi]))
        part = np.zeros_like(m)
        if axis == 0: part[cut:] = True
        else: part[:, cut:] = True
        labels[sl][m & part] = n + 1; n += 1; changed = True
    if not changed: break
objs = ndimage.find_objects(labels)
comps = []
for i, sl in enumerate(objs):
    if sl is None: continue
    area = int((labels[sl] == i + 1).sum())
    if area < 25: continue
    comps.append({'lab': [i + 1], 'x0': sl[1].start, 'y0': sl[0].start, 'x1': sl[1].stop, 'y1': sl[0].stop, 'area': area})
comps.sort(key=lambda c: -c['area'])
want = 8 * len(ROWS)
mains, rest = comps[:want], comps[want:]
for c in rest:  # attach loose bits (hair tips, shoe edges) to the nearest figure
    cx, cy = (c['x0'] + c['x1']) / 2, (c['y0'] + c['y1']) / 2
    def d(m): dx = max(m['x0'] - cx, 0, cx - m['x1']); dy = max(m['y0'] - cy, 0, cy - m['y1']); return dx * dx + dy * dy
    b = min(mains, key=d)
    if d(b) < 30 ** 2:
        b['lab'] += c['lab']
        for k, f in (('x0', min), ('y0', min), ('x1', max), ('y1', max)): b[k] = f(b[k], c[k])
mains.sort(key=lambda m: (m['y0'] + m['y1']) / 2)
rows = [sorted(mains[r * 8:(r + 1) * 8], key=lambda m: m['x0']) for r in range(len(ROWS))]

# Scale from the tallest-standing frames of the new sheet.
heights = [m['y1'] - m['y0'] for m in mains]
scale = idle_h / np.median(heights) * float(sys.argv[4] if len(sys.argv) > 4 else 1.08)  # new art has bigger hair, so match body size a bit larger

# Use the palette of the existing sheet so colors match the other animations.
rgb = Image.new('RGB', atlas.size, (0, 0, 0)); rgb.paste(atlas, mask=atlas.split()[3])
pal = rgb.quantize(colors=32, method=Image.Quantize.MEDIANCUT)

for row_i, row in zip(ROWS, rows):
    # clear the old row
    clear = Image.new('RGBA', (CW * 8, CH), (0, 0, 0, 0)); atlas.paste(clear, (0, row_i * CH))
    for c, m in enumerate(row):
        x0, y0, x1, y1 = m['x0'], m['y0'], m['x1'], m['y1']
        piece = a[y0:y1, x0:x1].copy(); keep = np.isin(labels[y0:y1, x0:x1], m['lab'])
        piece[..., 3] = np.where(keep, piece[..., 3], 0)
        crop = Image.fromarray(piece)
        w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
        sm = crop.resize((w, h), Image.BOX); arr = np.array(sm); arr[..., 3] = np.where(arr[..., 3] > 110, 255, 0)
        sm = Image.fromarray(arr)
        r2 = Image.new('RGB', sm.size, (0, 0, 0)); r2.paste(sm, mask=sm.split()[3])
        q = r2.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA'); q.putalpha(sm.split()[3])
        mm = np.array(q)[..., 3] > 0; mid = mm[int(h * 0.35):int(h * 0.75)]
        cx = np.where(mid)[1].mean() if mid.any() else w / 2
        ox = max(0, min(CW - w, int(round(OX - cx)))); oy = max(0, BASE - h)
        atlas.alpha_composite(q, (c * CW + ox, row_i * CH + oy))

atlas.save(ATLAS + '.png')
print('replaced rows', ROWS, 'scale', round(scale, 3), 'target height', idle_h)
