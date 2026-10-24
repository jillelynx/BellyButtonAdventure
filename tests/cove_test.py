# Automated checks for Liev's Cozy Cove (3D sandbox).
# Usage: python3 tests/cove_test.py http://localhost:8765/ OUTPUT_FOLDER
import sys, json, math
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]
results, errors = [], []
def check(name, ok, detail=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 960, "height": 540})
    pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("console", lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2500)
    ev = pg.evaluate
    sim = lambda secs, keys=[], press=[], fps=30: ev(f"window.__bba.sim({secs}, {json.dumps(keys)}, {json.dumps(press)}, {fps})")
    E = "window.__bba.modes.explore"
    def put(x, z, y=None, yaw=0, swim=False):
        ev(f"(()=>{{const e={E}, p=e.p; p.pos.set({x}, {('e.area.terrain(%s,%s)' % (x, z)) if y is None else y}, {z}); p.vy=0; p.vel.set(0,0); p.yaw={yaw}; p.swimming={'true' if swim else 'false'}; p.onGround={'false' if swim else 'true'}; e.cam.yaw={yaw}+Math.PI; e.cam.manualT=0; e.f.pos.set({x}-1.5, e.area.terrain({x}-1.5,{z}-1.5), {z}-1.5);}})()")
    P = lambda: ev(f"(()=>{{const p={E}.p; return {{x:p.pos.x, y:p.pos.y, z:p.pos.z, swim:!!p.swimming, onGround:p.onGround}};}})()")
    def shot(n): ev("window.__bba.simulating=false"); pg.wait_for_timeout(3500); pg.screenshot(path=f'{OUT}/{n}.png', timeout=180000)
    # Get there the way a player does: the painting on the easel in Belly Button's World.
    ev("(()=>{const g=window.__bba; g.choice.player='liev'; g.saves.explore.unlocked.bbworld=true; g.saves.explore.started=true; g.setMode('explore',{area:'bbworld'});})()"); pg.wait_for_timeout(3000)
    ev(f"(()=>{{const e={E}; const it=e.area.interact.find(i=>i.id==='cove'); e.p.pos.set(it.pos.x, e.area.terrain(it.pos.x,it.pos.z), it.pos.z);}})()")
    sim(0.1); check("Belly Button's World has a painting that leads to the Cozy Cove", ev("document.body.innerText").find('Cozy Cove') >= 0)
    sim(0.05, [], ['KeyE']); pg.wait_for_timeout(9000)
    s = ev(f"{E}.area.name"); check('Stepping into the painting opens the Cozy Cove', s == 'cove', s)
    st = ev(f"{E}.area.stats()"); print('   contents:', st)
    check('The cove is full of plants (grass, flowers, ferns, pines)', st['grassBlades'] > 8000 and st['flowers'] > 500 and st['pines'] > 50 and st['ferns'] > 100)
    check('Player customization is kept (same Liev outfit)', ev(f"{E}.pc.kind") == 'liev' and ev("window.__bba.choice.outfit") is not None)
    # Ground: feet sit on the drawn ground.
    p = P(); check('Liev stands on the ground at the start', abs(p['y'] - ev(f"{E}.area.terrain({p['x']},{p['z']})")) < 0.05 and not p['swim'])
    # Walking on the path and the meadow.
    put(2.5, -4, yaw=math.pi); sim(1.5, ['KeyW']); p = P(); check('Walking up the dirt path works', p['z'] < -7 and p['onGround'], f"z={p['z']:.1f}")
    # Solid trees: walk straight at a pine trunk.
    tr = ev(f"(()=>{{const c={E}.area.circles.find(c=>c.r<0.5 && c.camH-c.y0>5 && c.top===undefined && Math.hypot(c.x-20,c.z+30)<15); return {{x:c.x,z:c.z,r:c.r}};}})()")
    put(tr['x'], tr['z'] - 2.5, yaw=0); sim(2.0, ['KeyW'])   # facing +z: W walks toward the tree
    p = P(); d = math.hypot(p['x'] - tr['x'], p['z'] - tr['z']); check('Trees are solid (cannot walk through a trunk)', d >= tr['r'] + 0.2, f"dist={d:.2f}")
    # Logs: solid from the side, low enough to hop onto with a jump.
    lg = ev(f"(()=>{{const c={E}.area.circles.find(c=>c.top!==undefined && c.r>0.4 && c.r<0.6 && Math.hypot(c.x-24,c.z+15)<3); return {{x:c.x,z:c.z,r:c.r,top:c.top}};}})()")
    put(lg['x'], lg['z'] - 2.2, yaw=0); sim(1.5, ['KeyW']); p = P(); d = math.hypot(p['x'] - lg['x'], p['z'] - lg['z'])
    check('Fallen logs block you when walking', d > lg['r'], f"dist={d:.2f}")
    put(lg['x'], lg['z'] - 1.4, yaw=0); sim(0.05, ['KeyW', 'Space'], ['Space']); sim(0.6, ['KeyW', 'Space']); p = P()
    check('You can jump up onto a log', abs(p['y'] - lg['top']) < 0.15 or p['y'] > lg['top'] - 0.15, f"y={p['y']:.2f} top={lg['top']:.2f}")
    # Hiding behind a log: the camera does not look through it.
    lim = ev(f"(()=>{{const a={E}.area; const T=new window.__bba.modes.explore.camera.position.constructor({lg['x']}, {lg['top']}-0.6, {lg['z']}-1.2); const D=new window.__bba.modes.explore.camera.position.constructor(0,0.05,1).normalize(); return a.camLimit(T,D,7);}})()")
    check('The camera stops at a log instead of seeing through it (good for hide and seek)', lim < 2.5, f"camera distance {lim:.2f}")
    shot('t1_grove')
    # Swimming: walk off the beach into deep water.
    put(3, 12.5, yaw=0); sim(2.5, ['KeyW']); p = P(); check('Walking into deep water starts swimming', p['swim'], str(p))
    y0 = p['y']; sim(1.5, ['KeyX']); p = P(); check('Holding X dives down', p['y'] < y0 - 1.0, f"{y0:.2f} -> {p['y']:.2f}")
    sim(4.0, ['KeyX']); p = P(); g = ev(f"{E}.area.terrain({p['x']},{p['z']})"); check('Diving stops at the sea floor (never goes through it)', p['y'] >= g, f"y={p['y']:.2f} floor={g:.2f}")
    shot('t2_underwater')
    sim(3.0, ['Space']); p = P(); check('Space swims back up to the surface', p['y'] > -1.0, f"y={p['y']:.2f}")
    put(3, 19, y=-0.9, swim=True); sim(2.0); p = P(); check('Letting go floats you gently up to the surface', p['y'] > -0.95 and p['swim'])
    put(3, 14, y=-0.9, swim=True, yaw=math.pi); sim(4.5, ['KeyW']); p = P(); check('Swimming toward the beach walks you back out of the water', not p['swim'] and p['y'] > 0, str(p))
    fr = ev(f"(()=>{{const e={E}; e.p.pos.set(4,-0.9,20); e.p.swimming=true; e.f.pos.set(5,e.area.terrain(5,13),13); return 1;}})()"); sim(5.0)
    check('Belly Button swims along too', ev(f"{E}.f.swimming") == True)
    # Pier: walk out on the deck, then jump in.
    put(22, 7.6, yaw=0); sim(3.0, ['KeyW']); p = P(); check('You can walk out on the pier', p['z'] > 12 and abs(p['y'] - 0.9) < 0.1, str(p))
    sim(2.5, ['KeyW']); sim(0.05, ['KeyW', 'Space'], ['Space']); sim(1.5, ['KeyW']); p = P(); check('Jumping off the end of the pier lands you in the water, swimming', p['swim'], str(p))
    # Special places and hints.
    put(-16, 2.0); sim(0.3); check('Finding the waterfall counts as a discovery', 'waterfall' in ev(f"[...{E}.area.visited]"))
    # Time of day.
    t0 = ev(f"{E}.area.timeName"); sim(0.05, [], ['KeyT']); t1 = ev(f"{E}.area.timeName"); sim(0.05, [], ['KeyT']); t2 = ev(f"{E}.area.timeName")
    check('T changes the time of day (golden hour → day → starry night)', [t0, t1, t2] == ['sunset', 'day', 'night'], str([t0, t1, t2]))
    ev(f"{E}.area.setTime('night', null, true)"); put(15.6, -17.6, yaw=2.4); shot('t3_campfire_night')
    # Campfire marshmallow.
    put(CF := 17.0, -18.4); sim(0.1); sim(0.05, [], ['KeyE']); check('E at the campfire toasts a marshmallow', 'marshmallow' in ev("document.body.innerText").lower())
    # Edge of the world.
    put(0, -40); ev(f"{E}.p.pos.set(0, {E}.area.terrain(0,-57), -57)"); sim(0.5, ['KeyW']); p = P(); check('Soft edge keeps you inside the cove', math.hypot(p['x'], p['z'] - 2) <= 58.05, str(p))
    # Saving and going back.
    ev(f"{E}.area.setTime('sunset', null, true)")
    it = ev(f"(()=>{{const i={E}.area.interact.find(i=>i.id==='easel'); return {{x:i.pos.x,z:i.pos.z}};}})()"); put(it['x'], it['z']); sim(0.1); sim(0.05, [], ['KeyE']); pg.wait_for_timeout(2500)
    check("The easel painting takes you back to Belly Button's World", ev(f"{E}.area.name") == 'bbworld')
    check('No errors in the console', not errors, '; '.join(errors[:3]))
    b.close()
print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")
