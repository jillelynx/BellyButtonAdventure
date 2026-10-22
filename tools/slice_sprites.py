"""Cut the AI sprite sheet into clean, aligned game frames.

What it does (plain language):
1. Finds each little Liev on the sheet (7 rows x 8 frames).
2. Lines every frame up so his feet sit on the same ground line and his body
   stays centered (so he doesn't wobble or slide between frames).
3. Shrinks each frame to real pixel-art size with a small, fixed color palette,
   so it stays crisp when the game scales it up.
4. Saves one sprite sheet PNG + a manifest (frame order, speed, looping).

Usage: python3 tools/slice_sprites.py tools/liev_retro_source_A.png assets/sprites/liev_retro
"""
import sys, json
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
TARGET_H = int(sys.argv[3]) if len(sys.argv) > 3 else 52   # standing height in game pixels
CELL_W, CELL_H, BASE_Y, ORIGIN_X = 80, 72, 68, 40           # output cell; feet on y=68, centre x=40
ROWS = ['idle', 'walk', 'duck_slide', 'kick', 'punch', 'run', 'jump']

im = Image.open(SRC).convert('RGBA')
a = np.array(im)
alpha = a[..., 3]
solid = alpha > 100

def bands(mask1d, min_len, gap=3):
    out, s, quiet = [], None, 0
    for i, v in enumerate(mask1d):
        if v:
            if s is None: s = i
            quiet = 0
        elif s is not None:
            quiet += 1
            if quiet > gap: out.append((s, i - quiet + 1)); s = None; quiet = 0
    if s is not None: out.append((s, len(mask1d)))
    return [b for b in out if b[1] - b[0] >= min_len]

# Find each Liev as one connected blob (a little "glue" joins hair spikes and
# shoes to the body), then sort the blobs into 7 rows of 8.
from scipy import ndimage
labels, n = ndimage.label(solid)
# Some neighbouring figures touch (a shoe touching the hair below it). Split any
# blob that is about twice the normal size at its thinnest point.
def split_big(labels, n):
    objs = ndimage.find_objects(labels)
    areas = [(labels[sl] == i + 1).sum() if sl else 0 for i, sl in enumerate(objs)]
    big = sorted(areas)[-60:]; med = np.median([x for x in big if x > 2000])
    changed = False
    for i, sl in enumerate(objs):
        if not sl or areas[i] < med * 1.6: continue
        ys, xs = sl; m = labels[sl] == i + 1; h, w = m.shape
        if h > w * 1.4:   # stacked on top of each other: cut across
            prof = m.sum(1); lo, hi = int(h * 0.3), int(h * 0.7); cut = lo + int(np.argmin(prof[lo:hi]))
            sub = labels[sl]; part = np.zeros_like(m); part[cut:] = True; sub[m & part] = n + 1
        else:             # side by side: cut down the middle
            prof = m.sum(0); lo, hi = int(w * 0.3), int(w * 0.7); cut = lo + int(np.argmin(prof[lo:hi]))
            sub = labels[sl]; part = np.zeros_like(m); part[:, cut:] = True; sub[m & part] = n + 1
        n += 1; changed = True
    return labels, n, changed
for _ in range(4):
    labels, n, ch = split_big(labels, n)
    if not ch: break
objs = ndimage.find_objects(labels)
comps = []
for i, sl in enumerate(objs):
    if sl is None: continue
    area = int((labels[sl] == i + 1).sum())
    if area < 25: continue                          # ignore specks
    ys, xs = sl
    comps.append({'lab': i + 1, 'x0': xs.start, 'y0': ys.start, 'x1': xs.stop, 'y1': ys.stop, 'area': area})
comps.sort(key=lambda c: -c['area'])
mains = comps[:56]
assert min(c['area'] for c in mains) > 2500, 'could not find 56 separate figures'
# Attach loose pieces (hair tips, shoes, hands) to the nearest figure.
for c in comps[56:]:
    cx, cy = (c['x0'] + c['x1']) / 2, (c['y0'] + c['y1']) / 2
    def dist(m):
        dx = max(m['x0'] - cx, 0, cx - m['x1']); dy = max(m['y0'] - cy, 0, cy - m['y1']); return dx * dx + dy * dy
    best = min(mains, key=dist)
    if dist(best) < 30 ** 2:
        best.setdefault('extra', []).append(c['lab'])
        for k, f in (('x0', min), ('y0', min), ('x1', max), ('y1', max)): best[k] = f(best[k], c[k])
mains.sort(key=lambda m: (m['y0'] + m['y1']) / 2)
blobs = [[m['x0'], m['y0'], m['x1'], m['y1'], [m['lab']] + m.get('extra', [])] for m in mains]
frames = []
for r in range(7):
    row = sorted(blobs[r * 8:(r + 1) * 8], key=lambda b: b[0])
    for c, (x0, y0, x1, y1, lab) in enumerate(row):
        frames.append((r, c, x0, y0, x1, y1, lab))
H, W = solid.shape
# Scale: use the idle frames' height as "standing height".
idle_h = np.median([f[5] - f[3] for f in frames[:8]])
scale = TARGET_H / idle_h

def palette_from(img_list, n=32):
    big = Image.new('RGBA', (sum(i.width for i in img_list), max(i.height for i in img_list)))
    x = 0
    for i in img_list: big.paste(i, (x, 0)); x += i.width
    rgb = Image.new('RGB', big.size, (0, 0, 0)); rgb.paste(big, mask=big.split()[3])
    return rgb.quantize(colors=n, method=Image.Quantize.MEDIANCUT)

small = []
for f in frames:
    r, c, x0, y0, x1, y1, lab = f
    m = np.isin(labels[y0:y1, x0:x1], lab)
    piece = a[y0:y1, x0:x1].copy(); piece[..., 3] = np.where(m, piece[..., 3], 0)   # only this Liev, no bits of neighbours
    crop = Image.fromarray(piece)
    w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    sm = crop.resize((w, h), Image.BOX)
    arr = np.array(sm); arr[..., 3] = np.where(arr[..., 3] > 110, 255, 0)  # hard pixel edges
    small.append(Image.fromarray(arr))

pal = palette_from(small)
def quant(img):
    rgb = Image.new('RGB', img.size, (0, 0, 0)); rgb.paste(img, mask=img.split()[3])
    q = rgb.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    out = q.convert('RGBA'); out.putalpha(img.split()[3]); return out

sheet = Image.new('RGBA', (CELL_W * 8, CELL_H * 7), (0, 0, 0, 0))
anchors = []
for i, (f, sm) in enumerate(zip(frames, small)):
    r, c = f[0], f[1]
    sm = quant(sm)
    m = np.array(sm)[..., 3] > 0
    # horizontal anchor: centre of the body in the middle third (ignores flying hair/limbs)
    h = m.shape[0]; mid = m[int(h * 0.35):int(h * 0.75)]
    xs = np.where(mid.any(0))[0]
    cx = (np.where(mid)[1].mean()) if mid.any() else m.shape[1] / 2
    ox = int(round(ORIGIN_X - cx)); oy = BASE_Y - sm.height
    ox = max(0, min(CELL_W - sm.width, ox)); oy = max(0, oy)
    sheet.alpha_composite(sm, (c * CELL_W + ox, r * CELL_H + oy))
    anchors.append([r, c, ox, oy, sm.width, sm.height])

sheet.save(OUT + '.png')
manifest = {
    'image': OUT.split('/')[-1] + '.png', 'cell': [CELL_W, CELL_H], 'origin': [ORIGIN_X, BASE_Y],
    'note': 'Feet sit on y=origin[1] in every cell; the game moves the character, frames never do.',
    'animations': {
        'idle': {'row': 0, 'frames': list(range(8)), 'fps': 6, 'loop': True},
        'walk': {'row': 1, 'frames': list(range(8)), 'fps': 10, 'loop': True},
        'duck': {'row': 2, 'frames': [0, 1], 'fps': 12, 'loop': False, 'hold': 1},
        'slide': {'row': 2, 'frames': [2, 3, 4, 5, 6, 7], 'fps': 12, 'loop': False, 'holdRange': [3, 5]},
        'kick': {'row': 3, 'frames': list(range(8)), 'fps': 14, 'loop': False, 'contact': 3},
        'punch': {'row': 4, 'frames': list(range(8)), 'fps': 16, 'loop': False, 'contact': 3},
        'run': {'row': 5, 'frames': list(range(8)), 'fps': 14, 'loop': True},
        'jump': {'row': 6, 'frames': list(range(8)), 'fps': 12, 'loop': False,
                 'phases': {'anticipate': 0, 'takeoff': 1, 'rise': [2, 3], 'apex': 4, 'fall': 5, 'land': 6, 'recover': 7}},
    },
}
json.dump(manifest, open(OUT + '.json', 'w'), indent=1)
print('scale', round(scale, 3), 'frames', len(frames), 'sheet', sheet.size)
