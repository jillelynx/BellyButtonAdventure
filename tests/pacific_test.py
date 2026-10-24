# Automated checks for the South Pacific 1943 level (Ocean Door): island, submarine, fighter plane.
# Usage: python3 tests/pacific_test.py http://localhost:8765/ OUTPUT_FOLDER
import sys, json, math
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]
results, errors = [], []
def check(name, ok, detail=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)
T = 16; GY = 176

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("console", lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2500)
    ev = pg.evaluate
    sim = lambda secs, keys=[], press=[], fps=60: ev(f"window.__bba.sim({secs}, {json.dumps(keys)}, {json.dumps(press)}, {fps})")
    R = "window.__bba.modes.pacific"
    def place(x, y=GY, **kw):
        extra = ''.join(f"r.p.{k}={json.dumps(v)};" for k, v in kw.items())
        ev(f"(()=>{{const r={R}; r.p.x={x}; r.p.y={y}; r.p.vx=0; r.p.vy=0; r.p.sliding=0; r.p.action=null; r.p.h=44; r.hidden=false; r.resting=null; r.invuln=0; r.hearts=3; r.ebullets=[]; r.bombs=[]; r.rocks=[]; r.shells=[]; {extra} r.camX=Math.max(0,{x}-r.vw*0.38);}})()")
    def shot(n): ev("window.__bba.simulating=false"); pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/{n}.png')
    # Walk up to the Ocean Door and press E.
    ev("(()=>{const g=window.__bba; g.choice.player='liev'; g.saves.explore.unlocked.bbworld=true; g.saves.explore.started=true; g.setMode('explore',{area:'bbworld'});})()"); pg.wait_for_timeout(2500)
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(-22, e.area.terrain(-22,5.8), 5.8); e.p.yaw=Math.PI; e.cam.yaw=0;})()")
    sim(0.3); check('Walking up to the sea-blue Ocean Door discovers it', ev("window.__bba.saves.explore.doorsFound.includes('bbw-door4')"))
    shot('p0_ocean_door')
    sim(0.05, [], ['KeyE']); pg.wait_for_timeout(2600)
    s = sim(0.2)
    check('South Pacific level opens on the island', s['mode'] == 'pacific' and s['phase'] == 'foot')
    check('Liev starts with 3 hearts, pistol, rifle ammo and grenades', s['hearts'] == 3 and s['weapon'] == 'pistol' and s['ammo']['grenade'] == 3)
    check('Island has gun nests and 3 sailors to rescue', any(e['type'] == 'mg' for e in s['enemies']) and len(s['cages']) == 3)
    shot('p1_beach')
    # Anti-aircraft gun: bullets work on this one.
    aa = [i for i, e in enumerate(s['enemies']) if e['type'] == 'mg'][0]
    ev(f"{R}.enemies[{aa}].t=99; {R}.enemies[{aa}].state='cool'")
    place(20 * T, face=1); sim(0.05, [], ['Digit2'])
    for _ in range(3): sim(0.02, [], ['KeyX']); sim(0.7)
    st = ev(f"{R}.enemies[{aa}].state"); check('Rifle shots stop the anti-aircraft gun (white flag)', st in ('dizzy', 'out'), st)
    # Bunker: bullets ping off, a grenade stops it.
    bk = [i for i, e in enumerate(ev(f"{R}.enemies.map(e=>e.kind)")) if e == 'mg'][0]
    bx = ev(f"{R}.enemies[{bk}].x"); place(bx - 90, face=1); ev(f"{R}.enemies[{bk}].t=99; {R}.enemies[{bk}].state='cool'")
    sim(0.05, [], ['Digit1']); sim(0.02, [], ['KeyX']); sim(0.7)
    check('Bullets bounce off the concrete bunker', ev(f"{R}.enemies[{bk}].state") not in ('dizzy', 'out'))
    place(bx - 70, face=1); ev(f"{R}.ammo.grenade=3"); sim(0.05, [], ['Digit3']); sim(0.02, [], ['KeyX']); sim(1.6)
    st = ev(f"{R}.enemies[{bk}].state"); check('A grenade stops the bunker', st in ('dizzy', 'out'), st)
    shot('p2_bunker')
    # Rescue a sailor (E moves the logs).
    cx = ev(f"{R}.cages[0].x"); place(cx - 14, face=1); ev(f"{R}.enemies.forEach(e=>e.state='out')")
    s = sim(0.05, [], ['KeyE']); check('E moves the logs and rescues a sailor', s['rescued'] == 1)
    sim(0.3); shot('p3_sailor')
    # Rope bridge crumbles.
    place(31 * T, face=1); s = sim(0.6); check('The rope bridge gives way if you stand still', s['crumbles'] >= 1)
    # Hide in a hut from dive bombers.
    hx = ev(f"{R}.hides.find(h=>h.kind==='hut' && h.x>40*16).x"); place(hx, face=1); ev(f"{R}.planeT=0")
    sim(0.05); s = sim(0.05, ['ArrowDown'], ['ArrowDown']); s = sim(3.5)
    check('Hiding in a hut keeps Liev safe from the dive bombers', s['hidden'] and s['hearts'] == 3, f"hidden={s['hidden']} hearts={s['hearts']}")
    shot('p4_hut')
    # Reach the sub dock → submarine.
    place(136 * T, face=1); s = sim(1.2, ['ArrowRight'])
    check('Reaching the dock switches to the submarine', s['phase'] == 'sub', s['phase'])
    shot('p5_sub_start')
    # Submarine: steering.
    y0 = s['sub']['y']; s = sim(1.0, ['ArrowRight', 'ArrowDown']); check('Arrows steer the submarine (right and down)', s['sub']['x'] > 140 and s['sub']['y'] > y0 + 20, str(s['sub']))
    # Torpedo blows up a mine.
    ev(f"(()=>{{const r={R}; const m=r.mines[0]; r.sub.x=m.x-120; r.sub.y=m.y; r.sub.vx=0; r.sub.vy=0; r.sub.face=1; r.invuln=0; r.hearts=3; r.charges=[]; r.ships.forEach(s=>s.cool=99);}})()")
    sim(0.02, [], ['KeyX']); sim(0.8); check('A torpedo blows up a sea mine', not ev(f"{R}.mines[0].alive"))
    shot('p6_torpedo')
    # Hide in seaweed: ships stop dropping depth charges.
    ev(f"(()=>{{const r={R}; r.sub.x=860; r.sub.y=230; r.sub.vx=0; r.sub.vy=0; r.charges=[]; r.ships[0].x=860; r.ships[0].cool=0.6; r.ships[0].state='patrol';}})()")
    s = sim(2.0); check('Sitting still in seaweed hides the sub (no depth charges)', s['hidden'] and ev(f"{R}.charges.length") == 0, f"{s['hidden']} {s['sub']} {ev(R+'.charges.length')} {ev(R+'.torps.length')}")
    ev(f"(()=>{{const r={R}; r.sub.x=700; r.sub.y=150; r.charges=[]; r.ships[0].x=700; r.ships[0].cool=0; r.hearts=3; r.invuln=0;}})()")
    sim(0.2); check('Out in the open, a ship drops depth charges', ev(f"{R}.charges.length") >= 1)
    sim(1.0); shot('p7_depth_charge')
    # Torpedo near the surface stops a ship.
    ev(f"(()=>{{const r={R}; const sh=r.ships[1]; sh.x=2150; sh.state='patrol'; sh.hp=1; r.sub.x=2050; r.sub.y=70; r.sub.face=1; r.charges=[]; sh.cool=99;}})()")
    sim(0.02, [], ['KeyX']); s = sim(1.0); check('A torpedo near the surface stops a ship (crew rows away)', s['shipsStopped'] >= 1)
    # Buoy checkpoint.
    ev(f"(()=>{{const r={R}; r.sub.x=1095; r.sub.y=100; r.hearts=1; r.buoyDone[1]=false; r.charges=[]; r.ships.forEach(s=>s.cool=99);}})()")
    s = sim(0.5, ['ArrowRight']); check('Passing a red buoy repairs the sub and saves your place', s['hearts'] == 3)
    # Through the cave and to the end.
    ev(f"(()=>{{const r={R}; r.sub.x=1700; r.sub.y=200; r.invuln=9;}})()"); sim(1.0); shot('p8_cave')
    ev(f"(()=>{{const r={R}; r.sub.x=3440; r.sub.y=150;}})()"); s = sim(0.5, ['ArrowRight'])
    check('Reaching the end of the sea switches to the fighter plane', s['phase'] == 'plane', s['phase'])
    shot('p9_plane_start')
    # Plane: flying physics.
    s = sim(1.0); check('The plane keeps flying with power on', s['pl']['state'] == 'fly' and s['pl']['y'] < 500)
    a0 = s['pl']['a']; s = sim(0.4, ['ArrowUp']); check('↑ lifts the nose', s['pl']['a'] > a0 + 0.3, f"{a0:.2f}->{s['pl']['a']:.2f}")
    ev(f"(()=>{{const P={R}.pl; P.vx=60; P.vy=0; P.a=0.6; P.th=0; P.y=200;}})()"); s = sim(0.3)
    check('Flying too slowly makes the plane stall', s['pl']['stalled'])
    ev(f"(()=>{{const P={R}.pl; P.vx=190; P.vy=0; P.a=0; P.th=0.7; P.y=250; P.x=600;}})()"); sim(0.5)
    # Shoot an enemy plane right in front.
    ev(f"(()=>{{const r={R}; const P=r.pl; r.invuln=9; const e=r.eplanes[0]; e.x=P.x+80; e.y=P.y; e.a=0; e.v=0.01; e.hp=2;}})()")
    s = sim(0.6, ['KeyX']); check('Guns stop an enemy plane; the pilot parachutes out', s['kills'] >= 1 and ev(f"{R}.chutes.length") >= 1)
    sim(0.3); shot('p10_dogfight')
    # Landing: not before the planes are stopped; wheels needed; then a good landing finishes.
    ev(f"(()=>{{const r={R}; r.kills=6; r.eplanes=[]; r.spawned=6; const P=r.pl; P.x=4700; P.y=560; P.vx=110; P.vy=20; P.a=-0.05; P.th=0.3; P.gear=false; r.invuln=9;}})()")
    s = sim(0.6); check('Landing with the wheels up bounces you back up', s['pl']['state'] == 'fly')
    ev(f"(()=>{{const r={R}; const P=r.pl; P.x=4700; P.y=560; P.vx=110; P.vy=20; P.a=-0.05; P.th=0.3; P.gear=true;}})()")
    s = sim(0.6); check('A slow, gentle landing with wheels down lands on the carrier', s['pl']['state'] == 'landed', s['pl']['state'])
    shot('p11_landed')
    s = sim(2.5); check('Landing finishes the level', s['done'])
    pg.wait_for_timeout(600); check('Treasure Stamp is saved', 'bbw-door4' in ev("window.__bba.saves.platformer.stamps"))
    shot('p12_complete')
    # Admin shortcuts to each part.
    ev("window.__bba.ui.closePanel()"); ev("window.__bba.setMode('pacific',{level:'bbw-door4',phase:'sub'})"); pg.wait_for_timeout(1500)
    check('Admin: jump straight to the submarine', sim(0.1)['phase'] == 'sub')
    ev("window.__bba.setMode('pacific',{level:'bbw-door4',phase:'plane'})"); pg.wait_for_timeout(1500)
    check('Admin: jump straight to the fighter plane', sim(0.1)['phase'] == 'plane')
    ev("window.__bba.setMode('pacific',{level:'bbw-door4',checkpoint:4})"); pg.wait_for_timeout(1500)
    s = sim(0.1); check('Admin: jump to the dock section on foot', s['phase'] == 'foot' and s['p']['x'] > 120 * T)
    # Real-time drawing for a moment in each part, with no errors.
    pg.wait_for_timeout(1500)
    ev("window.__bba.modes.pacific.startSub()"); pg.wait_for_timeout(1500)
    ev("window.__bba.modes.pacific.startPlane()"); pg.wait_for_timeout(1500)
    check('No errors in the console', not errors, '; '.join(errors[:3]))
    b.close()
print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")
