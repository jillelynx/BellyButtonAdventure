# Builds Liev as a rigged 3D model in Blender and exports assets/models/liev.glb.
#
# Run with Blender's Python (bpy), from the game folder:
#   python3 tools/blender/build_liev.py        (needs the "bpy" package, Blender 4.x or 5.x)
#
# Everything is made from code: a smooth body (skin modifier + subdivision), an animated-film
# style head and face, spiky hair, and every outfit piece as its own mesh so the game can
# switch outfits, hair and the captain's hat. Bones are weighted here; the game animates them.
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models', 'liev.glb')
random.seed(12)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Blender: Z is up, the character faces -Y, his left side is +X.
def V(x, y, z): return Vector((x, y, z))
def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

MATS = {}
def mat(name, color, rough=0.8, metal=0.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    b.inputs['Base Color'].default_value = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1: b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    MATS[name] = m; return m

def link(name, me, material):
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    me.materials.clear(); me.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    return ob

def bake(ob):
    """Apply all modifiers and return a plain mesh object."""
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    name = ob.name; bpy.data.objects.remove(ob); return me, name

def skin_mesh(name, pts, edges, radii, material, sub=2, keep=None, root=0, roots=None):
    me = bpy.data.meshes.new(name); me.from_pydata([V(*p) for p in pts], edges, [])
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN')
    for i, r in enumerate(radii):
        d = me.skin_vertices[0].data[i]; d.radius = r if isinstance(r, tuple) else (r, r)
    for r_ in (roots or [root]): me.skin_vertices[0].data[r_].use_root = True
    ob.modifiers.new('sub', 'SUBSURF').levels = sub
    m2, n = bake(ob)
    if keep:
        bm = bmesh.new(); bm.from_mesh(m2)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context='VERTS')
        bm.to_mesh(m2); bm.free()
    return link(name, m2, material)

def prim(name, maker, material, xf=None, shape=None):
    """Make a primitive with bmesh, optionally bend its vertices with shape(co) and move it with xf."""
    bm = bmesh.new(); maker(bm)
    if shape:
        for v in bm.verts: v.co = shape(v.co.copy())
    if xf: bmesh.ops.transform(bm, matrix=xf, verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(name, me, material)

def uvsphere(segs=32, rings=16, r=1.0):
    return lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
def cone(r1, r2, d, segs=12):
    return lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=d)
def torus_maker(R, r, seg=32, rseg=8):
    def mk(bm):
        verts = []
        for i in range(seg):
            a = i / seg * math.tau
            for j in range(rseg):
                b = j / rseg * math.tau
                verts.append(bm.verts.new(V((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        for i in range(seg):
            for j in range(rseg):
                a, b2, c, d = i * rseg + j, i * rseg + (j + 1) % rseg, ((i + 1) % seg) * rseg + (j + 1) % rseg, ((i + 1) % seg) * rseg + j
                bm.faces.new((verts[a], verts[b2], verts[c], verts[d]))
    return mk
def tube_along(points, radius, segs=10, taper=None):
    """A tube following a list of points (for brows, the smile, hair strands)."""
    def mk(bm):
        rings = []
        for i, p in enumerate(points):
            t = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]; t.normalize()
            up = V(0, 0, 1) if abs(t.z) < 0.9 else V(1, 0, 0)
            n1 = t.cross(up).normalized(); n2 = t.cross(n1).normalized()
            r = radius * (taper(i / (len(points) - 1)) if taper else 1)
            rings.append([bm.verts.new(p + (n1 * math.cos(a) + n2 * math.sin(a)) * r) for a in [k / segs * math.tau for k in range(segs)]])
        for i in range(len(rings) - 1):
            for k in range(segs):
                bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    return mk

# ---------------------------------------------------------------------------------------------
# Colors (the game recolors outfits, but these are good defaults)
SKIN = mat('skin', '#F1C7A8', 0.65); HAIR = mat('hair', '#5A3820', 0.7); HAIR_L = mat('hair_light', '#7E5230', 0.7)
EYE_W = mat('eye_white', '#FBFAF7', 0.3); IRIS = mat('iris', '#5B3A23', 0.25); PUPIL = mat('pupil', '#120B07', 0.2); GLINT = mat('glint', '#FFFFFF', 0.1)
LIP = mat('lip', '#B5625A', 0.5); BROW = mat('brow', '#3A2418', 0.8); FRECK = mat('freckle', '#D49A78', 0.7); EAR_IN = mat('skin_shadow', '#E2AE8F', 0.7)
JACKET = mat('jacket', '#6FA06B', 0.85); HOODIE = mat('hoodie', '#2347C4', 0.85); ZIP = mat('zip', '#C9DA45', 0.5)
SHORTS = mat('shorts', '#1E1E22', 0.85); SOCKS = mat('socks', '#F4F4F4', 0.9); SHOES = mat('shoes', '#1D1D20', 0.45); SOLE = mat('sole', '#F0F0F0', 0.6)
SOCCER = mat('soccer_shirt', '#D2232A', 0.8); SOCCER_W = mat('soccer_white', '#FFFFFF', 0.8); ARMY = mat('army', '#6B7A4A', 0.9); BOOTS = mat('boots', '#A88B5E', 0.7)
HAT = mat('hat', '#A39F8E', 0.9); SILVER = mat('silver', '#DDE1E6', 0.3, 0.9); BELT = mat('belt', '#2A2620', 0.7)

# ---------------------------------------------------------------------------------------------
# Skeleton points (shared by the body, the clothes and the bones)
J = dict(pelvis=V(0, 0, 0.80), waist=V(0, 0, 0.90), chest=V(0, 0, 1.02), upper=V(0, 0, 1.10), neck0=V(0, 0, 1.14), neck1=V(0, 0, 1.2))
for s, n in ((1, 'L'), (-1, 'R')):
    J['sho' + n] = V(s * 0.165, 0, 1.105); J['elb' + n] = V(s * 0.232, 0.012, 0.865); J['wri' + n] = V(s * 0.28, 0, 0.65); J['hand' + n] = V(s * 0.295, -0.014, 0.55)
    J['hip' + n] = V(s * 0.085, 0, 0.765); J['kne' + n] = V(s * 0.088, 0, 0.43); J['ank' + n] = V(s * 0.088, 0.012, 0.085); J['toe' + n] = V(s * 0.09, -0.105, 0.04)

def chain(names): return [tuple(J[n]) for n in names]

# ---- Body (bare skin underneath the clothes) ----
for s_, n_ in ((1, 'L'), (-1, 'R')): J['calf' + n_] = V(s_ * 0.088, 0.008, 0.31)
names = ['pelvis', 'waist', 'chest', 'upper', 'neck0', 'neck1', 'shoL', 'elbL', 'wriL', 'handL', 'shoR', 'elbR', 'wriR', 'handR', 'hipL', 'kneL', 'calfL', 'ankL', 'toeL', 'hipR', 'kneR', 'calfR', 'ankR', 'toeR']
idx = {n: i for i, n in enumerate(names)}
E = [('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'upper'), ('upper', 'neck0'), ('neck0', 'neck1')]
for n in 'LR': E += [('upper', 'sho' + n), ('sho' + n, 'elb' + n), ('elb' + n, 'wri' + n), ('wri' + n, 'hand' + n), ('pelvis', 'hip' + n), ('hip' + n, 'kne' + n), ('kne' + n, 'calf' + n), ('calf' + n, 'ank' + n), ('ank' + n, 'toe' + n)]
R = dict(pelvis=(0.098, 0.07), waist=(0.096, 0.066), chest=(0.11, 0.072), upper=(0.116, 0.068), neck0=0.042, neck1=0.039)
for n in 'LR': R.update({'sho' + n: 0.054, 'elb' + n: 0.042, 'wri' + n: 0.032, 'hand' + n: (0.046, 0.025), 'hip' + n: 0.074, 'kne' + n: 0.052, 'calf' + n: 0.05, 'ank' + n: 0.037, 'toe' + n: (0.034, 0.024)})
# Every outfit covers the chest and the hips, so the skin there is removed (it would only poke through the clothes).
def body_keep(co):
    r = math.hypot(co.x, co.y)
    if 0.6 < co.z < 1.165 and abs(co.x) < 0.15 and not (co.z > 1.1 and r < 0.047): return False
    return True
body = skin_mesh('body', chain(names), [(idx[a], idx[b]) for a, b in E], [R[n] for n in names], SKIN, keep=body_keep)

# ---- Head: an oval animated-film kid's head (bigger cranium, small chin, round cheeks) ----
HC = V(0, -0.006, 1.312)
def head_shape(c):
    d = c.normalized(); x, fwd, up = d.x, -d.y, d.z
    sx, sb, sf, su, sd = 0.106, 0.118, 0.11, 0.128, 0.108
    px = x * sx; py = (fwd * sf if fwd > 0 else fwd * sb); pz = up * (su if up > 0 else sd)
    if up < 0:   # jaw narrows to a soft chin
        t = (-up) ** 1.35; px *= 1 - 0.2 * t
        if fwd < 0.2: py *= 1 - 0.18 * t
    if up > 0.1 and fwd < 0.3: pz *= 1.02; py *= 1.03               # rounder back of the skull
    def bump(cx, cf, cu, rad, amt):                                  # a soft round bump on the surface
        dd = (x - cx) ** 2 + (fwd - cf) ** 2 + (up - cu) ** 2; return amt * math.exp(-dd / (rad * rad))
    cheek = bump(0.5, 0.7, -0.25, 0.34, 1) + bump(-0.5, 0.7, -0.25, 0.34, 1)
    nose = bump(0, 0.98, -0.12, 0.13, 1); bridge = bump(0, 0.99, 0.08, 0.1, 0.4)
    sock = bump(0.36, 0.92, 0.12, 0.13, 1) + bump(-0.36, 0.92, 0.12, 0.13, 1)
    brow = bump(0, 0.9, 0.3, 0.35, 1)
    p = V(px, -py, pz); n = V(x, -fwd, up).normalized()
    p += n * (cheek * 0.016 + brow * 0.004 - sock * 0.009)
    p += V(0, -1, 0) * (nose * 0.016 + bridge * 0.008)
    p += V(0, 0, -1) * nose * 0.004
    return p
def head_point(x, fwd, up, out=0.0):
    """A point on the head surface from a direction (x = left, fwd = forward, up), pushed out by 'out'."""
    d = V(x, -fwd, up).normalized(); p = head_shape(d); return HC + p + d * out
head = prim('headskin', uvsphere(72, 48), SKIN, xf=Matrix.Translation(HC), shape=head_shape)
# Ears
for s in (1, -1):
    prim('ear', uvsphere(16, 10, 1), SKIN, xf=Matrix.Translation(head_point(s * 1, 0.05, -0.02, -0.006)) @ Matrix.Rotation(s * -0.35, 4, 'Z') @ Matrix.Diagonal((0.012, 0.03, 0.036, 1)))
    prim('ear_in', uvsphere(12, 8, 1), EAR_IN, xf=Matrix.Translation(head_point(s * 1, 0.1, -0.02, 0.0)) @ Matrix.Rotation(s * -0.35, 4, 'Z') @ Matrix.Diagonal((0.006, 0.017, 0.022, 1)))

# ---- Face: big brown eyes, thick brows, freckles, a little lopsided smile ----
def face_frame(x, fwd, up):
    """Position and a matrix that turns +Z to face out of the head at that spot."""
    p = head_point(x, fwd, up); e = 0.01
    a = head_point(x + e, fwd, up) - head_point(x - e, fwd, up); b = head_point(x, fwd, up + e) - head_point(x, fwd, up - e)
    n = a.cross(b).normalized()
    if n.dot(p - HC) < 0: n = -n
    z = n; xx = V(0, 0, 1).cross(z).normalized(); y = z.cross(xx)
    return p, Matrix(((xx.x, y.x, z.x), (xx.y, y.y, z.y), (xx.z, y.z, z.z))).to_4x4()
for s in (1, -1):
    p, M = face_frame(s * 0.36, 0.93, 0.12)
    T = lambda off: Matrix.Translation(p + (M.to_3x3() @ off))
    prim('eye_white', uvsphere(24, 16, 1), EYE_W, xf=T(V(0, 0, -0.008)) @ M @ Matrix.Diagonal((0.0275, 0.025, 0.016, 1)))
    prim('iris', uvsphere(20, 12, 1), IRIS, xf=T(V(-s * 0.002, -0.001, 0.0058)) @ M @ Matrix.Diagonal((0.0165, 0.0178, 0.004, 1)))
    prim('pupil', uvsphere(16, 10, 1), PUPIL, xf=T(V(-s * 0.002, -0.001, 0.0078)) @ M @ Matrix.Diagonal((0.0078, 0.0085, 0.0025, 1)))
    prim('glint', uvsphere(10, 6, 1), GLINT, xf=T(V(-s * 0.002 + 0.005, 0.005, 0.0092)) @ M @ Matrix.Diagonal((0.0034, 0.0034, 0.0012, 1)))
    # Upper eyelid (blinks in the game) — a skin cap over the top of the eye.
    prim('lid_' + ('L' if s > 0 else 'R'), lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1), SKIN,
         xf=T(V(0, 0.002, -0.0075)) @ M @ Matrix.Diagonal((0.0285, 0.025, 0.018, 1)), shape=lambda c: c if c.y > 0.52 else V(c.x, 0.52 + (c.y - 0.52) * 0.05, c.z * 0.95))
    # Lash line and eyebrow
    lash = [p + M.to_3x3() @ V(math.cos(a) * 0.027, math.sin(a) * 0.021 + 0.002, 0.008 - abs(math.cos(a)) * 0.004) for a in [math.pi * (0.05 + 0.9 * k / 10) for k in range(11)]]
    prim('lash', tube_along(lash, 0.0018, 6), BROW)
    bp, BM = face_frame(s * 0.37, 0.88, 0.33)
    brow = [bp + BM.to_3x3() @ V(s * (-0.03 + 0.06 * t), 0.006 * math.sin(math.pi * t) - 0.004 * t * s * s, 0.003) for t in [k / 10 for k in range(11)]]
    prim('brow', tube_along(brow, 0.0068, 8, taper=lambda t: 1.15 - 0.45 * t), BROW)
# Smile (a little higher on his right side, like the reference)
mp, MM = face_frame(0.0, 0.97, -0.43)
smile = [mp + MM.to_3x3() @ V(0.034 * (t * 2 - 1), -0.009 * math.sin(math.pi * t) + 0.004 * (t - 0.5) - 0.002, 0.003) for t in [k / 14 for k in range(15)]]
prim('smile', tube_along(smile, 0.0026, 8, taper=lambda t: 0.6 + 0.4 * math.sin(math.pi * t)), LIP)
# Freckles across the nose and cheeks
for k in range(12):
    s = 1 if k % 2 else -1; xx = s * (0.14 + random.random() * 0.26); uu = -0.04 - random.random() * 0.14
    fp, FM = face_frame(xx, 0.95, uu)
    prim('freckle', uvsphere(6, 4, 1), FRECK, xf=Matrix.Translation(fp) @ FM @ Matrix.Diagonal((0.0019, 0.0019, 0.0006, 1)))

# ---- Hair: a fitted cap plus spiky, tousled clumps (everyday), or a styled-up quiff with a faded side (styled) ----
def cap_shape(c, lift=0.009, nape=-0.25, front=0.42):
    d = c.normalized(); x, fwd, up = d.x, -d.y, d.z
    p = head_shape(d) + d * lift
    # The hairline: above the forehead in front, above the ears on the sides, the nape at the back.
    line = front if fwd > 0.6 else (-0.05 if abs(x) > 0.75 else nape)
    line = front * sstep(0.35, 0.8, fwd) + (1 - sstep(0.35, 0.8, fwd)) * (-0.05 * sstep(0.5, 0.9, abs(x)) + nape * (1 - sstep(0.5, 0.9, abs(x))))
    k = sstep(line - 0.12, line + 0.03, up)               # fade smoothly into the skin at the hairline
    p = head_shape(d) + d * (lift * k - 0.004 * (1 - k))
    return HC + p
def make_cap(name, lift, material, nape=-0.25, front=0.42):
    return prim(name, uvsphere(72, 48), material, shape=lambda c: cap_shape(c, lift, nape, front))
def clump(points_root, direction, length, radius, bend):
    pts = []
    for k in range(6):
        t = k / 5; pts.append(points_root + direction * (length * t) + bend * (length * t * t))
    return tube_along(pts, radius, 7, taper=lambda t: max(0.08, (1 - t) ** 0.9))
everyday = [make_cap('hair_everyday_cap', 0.011, HAIR)]
for k in range(60):
    # spikes over the top, swept up and slightly forward/back; a messy fringe at the front
    u = random.random(); a = random.random() * math.tau
    fwd = math.cos(a) * (0.9 if math.cos(a) > 0 else 0.95); x = math.sin(a) * 0.95
    up = 0.35 + u * 0.6
    if fwd > 0.55 and up < 0.5: continue
    root = head_point(x * (1 - up * 0.5), fwd * (1 - up * 0.5), up, 0.004)
    nrm = (root - HC).normalized()
    dirv = (nrm + V(0, 0, 0.9) + V(0, -0.35 if fwd > 0.3 else 0.25, 0)).normalized()
    side = V(x, 0, 0) * 0.4
    L = 0.032 + random.random() * 0.028 if up > 0.55 else 0.026 + random.random() * 0.018
    everyday.append(prim('hair_everyday', clump(root, dirv, L, 0.022 + random.random() * 0.01, side + V(random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), -0.25)), HAIR if k % 4 else HAIR_L))
for k in range(9):   # fringe tufts swept up and to the side
    x = -0.5 + k / 8; root = head_point(x * 0.7, 0.86, 0.42 + 0.06 * math.cos(x * 3), 0.003)
    everyday.append(prim('hair_everyday', clump(root, V(0.25 * x, -0.45, 0.9).normalized(), 0.05 + random.random() * 0.02, 0.02, V(0.35 * x, -0.15, -0.1)), HAIR_L if k % 3 == 0 else HAIR))
styled = [make_cap('hair_styled_cap', 0.006, HAIR, nape=-0.1, front=0.44), make_cap('hair_styled_fade', 0.0035, mat('fade', '#8C6A52', 0.85), nape=-0.3, front=0.3)]
for k in range(44):   # a tall swept-up quiff on top, short faded sides
    a = random.random() * math.tau; r = random.random() ** 0.6 * 0.55
    x, fwd = math.sin(a) * r * 0.75, math.cos(a) * r + 0.1
    root = head_point(x, fwd, 0.85, 0.004)
    dirv = V(x * 0.3, -0.55 - fwd * 0.2, 1).normalized()
    styled.append(prim('hair_styled', clump(root, dirv, 0.06 + (fwd + 0.6) * 0.03 + random.random() * 0.02, 0.02, V(0, -0.2, -0.15)), HAIR if k % 4 else HAIR_L))
# The lightning bolt shaved into the LEFT side (a lighter brown inlay)
bolt_pts2 = [(0.0, 0.03), (-0.015, 0.0), (0.004, 0.002), (-0.012, -0.03), (0.016, 0.006), (-0.002, 0.004), (0.012, 0.03)]
def bolt_maker(bm):
    vs = []
    for (bx, bz) in bolt_pts2:
        vs.append(bm.verts.new(head_point(1.0, 0.0 + bx * 8, 0.32 + bz * 6, 0.0055)))
    bm.faces.new(vs)
prim('hair_styled_bolt', bolt_maker, mat('bolt', '#B08A6A', 0.8))

# ---- Clothes ----
def keep_above(z): return lambda co: co.z >= z
def keep_arm_until(n, frac):
    """Keep everything except the part of the arm past 'frac' of the way from elbow to wrist (for sleeves)."""
    def k(co):
        for s in 'LR':
            a, b = J['elb' + s], J['wri' + s]; ab = b - a; t = (co - a).dot(ab) / ab.length_squared
            if (co.x > 0) == (s == 'L') and abs(co.x) > 0.12 and t > frac: return False
        return True
    return k
def keep_upperarm_until(frac):
    def k(co):
        for s in 'LR':
            a, b = J['sho' + s], J['elb' + s]; ab = b - a; t = (co - a).dot(ab) / ab.length_squared
            if (co.x > 0) == (s == 'L') and abs(co.x) > 0.15 and t > frac: return False
        return True
    return k
TOP = ['pelvis', 'waist', 'chest', 'upper', 'neck0', 'shoL', 'elbL', 'wriL', 'shoR', 'elbR', 'wriR']
TE = [('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'upper'), ('upper', 'neck0'), ('upper', 'shoL'), ('shoL', 'elbL'), ('elbL', 'wriL'), ('upper', 'shoR'), ('shoR', 'elbR'), ('elbR', 'wriR')]
ti = {n: i for i, n in enumerate(TOP)}
def top_pts(hem): return [tuple(J[n]) if n != 'pelvis' else (0, 0, hem) for n in TOP]
def top(name, material, radii_add, hem, keep):
    rr = {'pelvis': (0.128, 0.092), 'waist': (0.122, 0.088), 'chest': (0.138, 0.094), 'upper': (0.146, 0.088), 'neck0': (0.066, 0.062)}
    rr.update({'shoL': 0.06, 'elbL': 0.047, 'wriL': 0.04, 'shoR': 0.06, 'elbR': 0.047, 'wriR': 0.04})
    radii = [tuple(v + radii_add for v in (rr[n] if isinstance(rr[n], tuple) else (rr[n], rr[n]))) for n in TOP]
    return skin_mesh(name, top_pts(hem), [(ti[a], ti[b]) for a, b in TE], radii, material, keep=lambda co: co.z >= hem - 0.005 and keep(co))
# Play clothes: camo zip jacket over a royal-blue hoodie (hood, cuffs and hem peek out)
top('play_jacket', JACKET, 0.012, 0.79, keep_arm_until('', 0.93))
prim('play_hood', uvsphere(24, 14, 1), HOODIE, xf=Matrix.Translation(V(0, 0.09, 1.12)) @ Matrix.Diagonal((0.095, 0.04, 0.055, 1)))
prim('play_collar', torus_maker(0.056, 0.017, 32, 8), HOODIE, xf=Matrix.Translation(V(0, 0.006, 1.178)) @ Matrix.Diagonal((1, 0.86, 1, 1)))
prim('play_hem', torus_maker(0.13, 0.016, 40, 8), HOODIE, xf=Matrix.Translation(V(0, 0, 0.79)) @ Matrix.Diagonal((1.02, 0.74, 1, 1)))
for s in (1, -1):
    a, b = J['elb' + ('L' if s > 0 else 'R')], J['wri' + ('L' if s > 0 else 'R')]; c = a.lerp(b, 0.95); d = (b - a).normalized()
    rot = V(0, 0, 1).rotation_difference(d).to_matrix().to_4x4()
    prim('play_cuff', torus_maker(0.036, 0.012, 20, 6), HOODIE, xf=Matrix.Translation(c) @ rot)
zip_pts = [V(0, -0.0, 0) + V(0, -(0.096 + 0.004), z) for z in [0.8 + k * 0.035 for k in range(10)]]
zip_pts = [V(0, -max(0.094, 0.088 + 0.0) - 0.006 - 0.004 * math.sin((z - 0.79) * 9), z) for z in [0.795 + k * 0.034 for k in range(11)]]
prim('play_zip', tube_along(zip_pts, 0.0035, 6), ZIP)
# Soccer #12: red shirt with short sleeves and white trim
top('soccer_shirt', SOCCER, 0.009, 0.79, keep_upperarm_until(0.55))
prim('soccer_collar', torus_maker(0.066, 0.01, 32, 6), SOCCER_W, xf=Matrix.Translation(V(0, 0, 1.15)) @ Matrix.Diagonal((1, 0.86, 1, 1)))
# Army camo: long sleeves, belt, trousers and boots
top('army_shirt', ARMY, 0.011, 0.79, keep_arm_until('', 0.95))
prim('army_belt', torus_maker(0.125, 0.012, 40, 6), BELT, xf=Matrix.Translation(V(0, 0, 0.81)) @ Matrix.Diagonal((1.03, 0.76, 1.2, 1)))
# Shorts (black) and trousers
LOW = ['pelvis', 'mid', 'hipL', 'kneL', 'hipR', 'kneR']; li = {n: i for i, n in enumerate(LOW)}
LE = [('pelvis', 'mid'), ('mid', 'hipL'), ('hipL', 'kneL'), ('mid', 'hipR'), ('hipR', 'kneR')]
def lowpts(top_z): return [(0, 0, top_z), (0, 0, 0.76)] + [tuple(J[n]) for n in LOW[2:]]
skin_mesh('shorts', lowpts(0.86), [(li[a], li[b]) for a, b in LE], [(0.13, 0.094), (0.165, 0.096), 0.094, 0.079, 0.094, 0.079], SHORTS, keep=lambda co: co.z > 0.52 and co.z < 0.87)
TR = ['pelvis', 'hipL', 'kneL', 'ankL', 'hipR', 'kneR', 'ankR']; tri = {n: i for i, n in enumerate(TR)}
TRE = [('pelvis', 'hipL'), ('hipL', 'kneL'), ('kneL', 'ankL'), ('pelvis', 'hipR'), ('hipR', 'kneR'), ('kneR', 'ankR')]
skin_mesh('army_trousers', [(0, 0, 0.86)] + [tuple(J[n]) for n in TR[1:]], [(tri[a], tri[b]) for a, b in TRE], [(0.13, 0.092), 0.086, 0.062, 0.048, 0.086, 0.062, 0.048], ARMY, keep=lambda co: co.z > 0.16 and co.z < 0.87)
# Socks (white ankle socks for play clothes, tall red socks for soccer), shoes, boots
SK = ['kneL', 'calfL', 'ankL', 'kneR', 'calfR', 'ankR']; ski = {n: i for i, n in enumerate(SK)}
def socks(name, top_z, material):
    return skin_mesh(name, [tuple(J[n]) for n in SK], [(0, 1), (1, 2), (3, 4), (4, 5)], [0.06, 0.058, 0.043, 0.06, 0.058, 0.043], material, roots=[0, 3], keep=lambda co: co.z < top_z and co.z > 0.05)
socks('socks_low', 0.21, SOCKS); socks('socks_soccer', 0.39, mat('soccer_socks', '#D2232A', 0.9))
def shoe(name, material, tall=0.0, sole_mat=None):
    parts = []
    for s in (1, -1):
        x = s * 0.09
        pts = [(x, 0.04, 0.055 + tall * 0.5), (x, -0.02, 0.05), (x, -0.085, 0.043), (x, -0.14, 0.038)]
        if tall: pts = [(x, 0.012, 0.085 + tall)] + pts
        rad = ([0.045] if tall else []) + [(0.05, 0.045), (0.055, 0.04), (0.053, 0.034), (0.041, 0.027)]
        parts.append(skin_mesh(name, pts, [(i, i + 1) for i in range(len(pts) - 1)], rad, material, keep=lambda co: co.z > 0.012))
        if sole_mat:
            sp = [(x, 0.045, 0.012), (x, -0.145, 0.012)]
            parts.append(skin_mesh(name + '_sole', sp, [(0, 1)], [(0.052, 0.012), (0.046, 0.012)], sole_mat, keep=lambda co: co.z >= -0.0005 and co.z < 0.03))
    return parts
shoe('shoes', SHOES, 0, SOLE); shoe('boots', BOOTS, 0.12, mat('boot_sole', '#5A4A35', 0.8))
# Captain's hat (patrol cap) with two silver bars
hat_top = head_point(0, 0, 1, 0.0).z
prim('hat', cone(0.118, 0.112, 0.085, 32), HAT, xf=Matrix.Translation(V(0, 0.004, hat_top - 0.012)) @ Matrix.Diagonal((0.95, 1.06, 1, 1)))
prim('hat', lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.1, radius2=0.1, depth=0.01), HAT,
     xf=Matrix.Translation(V(0, -0.105, hat_top - 0.045)) @ Matrix.Rotation(0.18, 4, 'X') @ Matrix.Diagonal((1.0, 0.65, 1, 1)), shape=lambda c: c if c.y < 0.0 else V(c.x, c.y * 0.1, c.z))
for s in (1, -1): prim('hat_bar', lambda bm: bmesh.ops.create_cube(bm, size=1), SILVER, xf=Matrix.Translation(V(s * 0.013, -0.122, hat_top - 0.005)) @ Matrix.Diagonal((0.009, 0.004, 0.032, 1)))

# ---------------------------------------------------------------------------------------------
# Join pieces that share a name (fewer meshes = faster), then rig.
groups = {}
for ob in list(scene.collection.objects):
    if ob.type == 'MESH': groups.setdefault(ob.name.split('.')[0], []).append(ob)
final = []
for name, obs in groups.items():
    # merge by material: one object per (name, material)
    bym = {}
    for o in obs: bym.setdefault(o.data.materials[0].name, []).append(o)
    for mname, lst in bym.items():
        bm = bmesh.new()
        for o in lst:
            m2 = o.data.copy(); m2.transform(o.matrix_world); bm.from_mesh(m2); bpy.data.meshes.remove(m2)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        for o in lst: bpy.data.objects.remove(o)
        nob = link(name if len(bym) == 1 else f'{name}__{mname}', me, MATS[mname]); final.append(nob)

# Smooth shading everywhere (no flat facets).
for ob in final:
    me = ob.data
    for at in ('sharp_face', 'sharp_edge'):
        if at in me.attributes: me.attributes.remove(me.attributes[at])
    if hasattr(me, 'shade_smooth'): me.shade_smooth()
    else:
        for p_ in me.polygons: p_.use_smooth = True

# UVs: wrap shirts like a label (front at u = 0.25, back at u = 0.75) so the game's shirt pictures and camo line up.
for ob in final:
    me = ob.data; uv = me.uv_layers.new(name='UVMap')
    lo, hi = 0.79, 1.16
    for poly in me.polygons:
        us = []
        for li_ in poly.loop_indices:
            co = me.vertices[me.loops[li_].vertex_index].co
            u = 0.25 + math.atan2(co.x, -co.y) / math.tau; vv = (co.z - lo) / (hi - lo)
            us.append([u, vv])
        if max(u for u, _ in us) - min(u for u, _ in us) > 0.5:
            for q in us:
                if q[0] < 0.25: q[0] += 1
        for k, li_ in enumerate(poly.loop_indices): uv.data[li_].uv = us[k]

# ---- Armature ----
arm_data = bpy.data.armatures.new('LievRig'); rig = bpy.data.objects.new('LievRig', arm_data); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
BONES = {}
def bone(name, head_, tail_, parent=None):
    b = arm_data.edit_bones.new(name); b.head = head_; b.tail = tail_
    if parent: b.parent = arm_data.edit_bones[parent]; b.use_connect = False
    BONES[name] = (Vector(head_), Vector(tail_)); return b
bone('b_root', V(0, 0, 0), V(0, 0, 0.2)); bone('b_hips', J['pelvis'], J['waist'], 'b_root'); bone('b_spine', J['waist'], J['chest'], 'b_hips'); bone('b_chest', J['chest'], J['upper'], 'b_spine')
bone('b_neck', J['neck0'], J['neck1'], 'b_chest'); bone('b_head', J['neck1'], V(0, 0, 1.46), 'b_neck')
for n in 'LR':
    bone('b_upperarm_' + n, J['sho' + n], J['elb' + n], 'b_chest'); bone('b_forearm_' + n, J['elb' + n], J['wri' + n], 'b_upperarm_' + n); bone('b_hand_' + n, J['wri' + n], J['hand' + n] + (J['hand' + n] - J['wri' + n]) * 0.6, 'b_forearm_' + n)
    bone('b_thigh_' + n, J['hip' + n], J['kne' + n], 'b_hips'); bone('b_shin_' + n, J['kne' + n], J['ank' + n], 'b_thigh_' + n); bone('b_foot_' + n, J['ank' + n], J['toe' + n], 'b_shin_' + n)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- Weights: each point follows its nearest bones, blended smoothly at the joints ----
RIGID_HEAD = ('headskin', 'ear', 'ear_in', 'eye_white', 'iris', 'pupil', 'glint', 'lid_L', 'lid_R', 'lash', 'brow', 'smile', 'freckle', 'hair_everyday', 'hair_everyday_cap', 'hair_styled', 'hair_styled_cap', 'hair_styled_fade', 'hair_styled_bolt', 'hat', 'hat_bar')
def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length, t
CAND = [n for n in BONES if n != 'b_root']
TORSO_ONLY = ('play_hem', 'play_zip', 'play_collar', 'play_hood', 'soccer_collar', 'army_belt')
NO_THIGH = ('play_jacket', 'soccer_shirt', 'army_shirt')
def allowed(base, n):
    if base in TORSO_ONLY: return n in ('b_hips', 'b_spine', 'b_chest', 'b_neck')
    if base == 'play_cuff': return n.startswith('b_forearm')
    if base in NO_THIGH and n.startswith('b_thigh'): return False
    return True
for ob in final:
    base = ob.name.split('__')[0]
    groups_ = {n: ob.vertex_groups.new(name=n) for n in CAND}
    for v in ob.data.vertices:
        p = v.co
        if base in RIGID_HEAD or p.z > 1.205 and abs(p.x) < 0.14:
            groups_['b_head'].add([v.index], 1.0, 'REPLACE'); continue
        best = []
        for n in CAND:
            if n == 'b_head' or not allowed(base, n): continue
            side = n[-1] if n[-2] == '_' else None
            if side == 'L' and p.x < -0.02: continue
            if side == 'R' and p.x > 0.02: continue
            a, b = BONES[n]; d, t = seg_dist(p, a, b)
            if n == 'b_neck' and p.z < 1.13: d += 0.05
            if n.startswith('b_upperarm') and abs(p.x) < 0.13: d += 0.06      # torso stays with the chest
            if n.startswith('b_thigh') and p.z > 0.79: d += 0.05
            best.append((d, n))
        best.sort()
        if len(best) == 1: groups_[best[0][1]].add([v.index], 1.0, 'REPLACE'); continue
        (d1, n1), (d2, n2) = best[0], best[1]
        w1 = 1 / (d1 ** 4 + 1e-9); w2 = 1 / (d2 ** 4 + 1e-9)
        if d2 > d1 * 1.8: w2 = 0
        tot = w1 + w2; groups_[n1].add([v.index], w1 / tot, 'REPLACE')
        if w2: groups_[n2].add([v.index], w2 / tot, 'ADD')
    mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = rig; ob.parent = rig

# ---- Export ----
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_skins=True, export_animations=False, export_morph=False, use_selection=False, export_yup=True, export_texcoords=True, export_normals=True)
print('wrote', os.path.abspath(OUT), 'meshes:', len(final))
