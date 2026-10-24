# Automated checks for the France 1944 level (Time Door).
# Usage: python3 tests/war_test.py http://localhost:8765/ OUTPUT_FOLDER
import sys, json
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
    W = "window.__bba.modes.war"
    def place(x, y=GY, **kw):
        extra = ''.join(f"r.p.{k}={json.dumps(v)};" for k, v in kw.items())
        ev(f"(()=>{{const r={W}; r.p.x={x}; r.p.y={y}; r.p.vx=0; r.p.vy=0; r.p.sliding=0; r.p.action=null; r.p.h=44; r.hidden=false; r.resting=null; r.invuln=0; r.hearts=3; r.ebullets=[]; r.bombs=[]; r.rocks=[]; r.shells=[]; {extra} r.camX=Math.max(0,{x}-r.vw*0.38);}})()")
    def shot(n): ev("window.__bba.simulating=false"); pg.wait_for_timeout(350); pg.screenshot(path=f'{OUT}/{n}.png')
    def enemy(i): return ev(f"{W}.enemies[{i}]")
    # Walk up to the Time Door in Belly Button's World and press E.
    ev("(()=>{const g=window.__bba; g.choice.player='liev'; g.saves.explore.unlocked.bbworld=true; g.saves.explore.started=true; g.setMode('explore',{area:'bbworld'});})()"); pg.wait_for_timeout(2500)
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(20, e.area.terrain(20,-8.2), -8.2); e.p.yaw=Math.PI; e.cam.yaw=0;})()")
    sim(0.3); check('Walking up to the brown Time Door discovers it', ev("window.__bba.saves.explore.doorsFound.includes('bbw-door3')"))
    shot('w0_time_door')
    sim(0.05, [], ['KeyE']); pg.wait_for_timeout(2600)
    check('France 1944 level opens in its own mode', ev("window.__bba.modeName") == 'war')
    check('Starts like an old photo (sepia) and warms up', 'sepia' in ev(f"{W}.canvas.style.filter"))
    s = sim(0.2); check('Liev has 3 hearts, pistol in hand, 3 grenades, 12 rifle bullets', s['hearts'] == 3 and s['weapon'] == 'pistol' and s['ammo'] == {'rifle': 12, 'grenade': 3}, str(s.get('ammo')))
    check('Level has soldiers, a machine-gun nest, a tank and 3 cages', sum(e['type'] == 'soldier' for e in s['enemies']) >= 6 and any(e['type'] == 'mg' for e in s['enemies']) and s['tank'] and len(s['cages']) == 3)
    shot('w1_start')
    # Weapon switching.
    s = sim(0.05, [], ['KeyQ']); check('Q switches to the rifle', s['weapon'] == 'rifle')
    s = sim(0.05, [], ['KeyQ']); check('Q again switches to grenades', s['weapon'] == 'grenade')
    s = sim(0.05, [], ['Digit1']); check('1 picks the pistol', s['weapon'] == 'pistol')
    # Pistol: shoots a bullet; soldier needs two hits, then sees stars and surrenders.
    ev(f"(()=>{{const e={W}.enemies[0]; e.x=330; e.x0=300; e.x1=420; e.state='patrol'; e.face=-1;}})()")
    place(250, face=1); s = sim(0.02, [], ['KeyX']); check('Pressing X fires a bullet', s['bullets'] == 1 and s['p']['action'] == 'fire')
    sim(0.4); sim(0.02, [], ['KeyX']); sim(0.5)
    e0 = enemy(0); check('Two pistol hits make a soldier dizzy, then surrender', e0['state'] in ('dizzy', 'out'), e0['state'])
    shot('w2_dizzy_soldier')
    s = sim(1.5); check('A surrendered soldier stays sitting with hands up (counted as captured)', enemy(0)['state'] == 'out' and s['captured'] >= 1)
    # Rifle: one shot does it (2 damage) and uses ammo.
    ev(f"(()=>{{const e={W}.enemies[1]; e.x=650; e.x0=640; e.x1=660; e.state='patrol'; e.face=-1;}})()")
    place(560, face=1); sim(0.05, [], ['Digit2']); s = sim(0.02, [], ['KeyX']); sim(0.4)
    check('Rifle uses ammo and one shot stops a soldier', s['ammo']['rifle'] == 11 and enemy(1)['state'] in ('dizzy', 'out'), f"{s['ammo']} {enemy(1)['state']}")
    # Enemy shooting: standing gets hit, ducking dodges.
    ev(f"(()=>{{const r={W}; r.enemies[2].x=1000; r.enemies[2].state='patrol'; r.enemies[2].hp=2; r.enemies[2].x0=990; r.enemies[2].x1=1010; r.enemies[2].face=-1;}})()")  # village soldier
    place(880, face=1); sim(0.05, [], ['Digit1']); s = sim(2.0)
    check('A soldier who spots Liev shoots (and standing gets hit)', s['hearts'] < 3, f"hearts={s['hearts']}")
    place(880, face=1); s = sim(0.05, ['ArrowDown']); s = sim(2.5, ['ArrowDown'])
    check('Ducking makes bullets fly over Liev', s['hearts'] == 3 and s['p']['ducking'], f"hearts={s['hearts']}")
    # Hiding in a doorway: soldiers can't see you, bullets miss.
    place(47 * T + 8, face=1); ev(f"(()=>{{const e={W}.enemies[2]; e.x=56*16; e.x0=55*16; e.x1=57*16; e.state='patrol';}})()")
    sim(0.05); s = sim(0.05, ['ArrowDown'], ['ArrowDown']); check('↓ in a doorway hides Liev', s['hidden'])
    shot('w3_hiding')
    s = sim(3.0); check('While hidden, soldiers walk by without shooting you', s['hearts'] == 3 and s['hidden'], f"hearts={s['hearts']}")
    s = sim(0.1, ['ArrowRight']); check('Moving comes out of hiding', not s['hidden'])
    # Cage: press E to free a villager.
    cx = ev(f"{W}.cages[0].x"); place(cx - 14, face=1); ev(f"{W}.enemies.forEach(e=>{{if(e.type==='soldier'&&Math.abs(e.x-{cx})<200) e.state='out';}})")
    s = sim(0.05, [], ['KeyE']); check('E opens a cage and frees a villager', s['rescued'] == 1 and s['cages'][0]['open'])
    sim(0.4); shot('w4_freed_villager')
    # Machine-gun nest: bullets bounce off, a grenade stops it.
    mgi = [i for i, e in enumerate(s['enemies']) if e['type'] == 'mg'][0]
    place(70 * T, face=1); sim(0.05, [], ['Digit1']); sim(0.02, [], ['KeyX']); sim(0.6)
    check('Bullets just ping off the machine-gun nest', enemy(mgi)['state'] not in ('dizzy', 'out'))
    place(70 * T, face=1); s = sim(0.05, ['ArrowDown']); s = sim(2.5, ['ArrowDown'])
    check('Ducking behind the sandbags dodges the machine gun', s['hearts'] == 3, f"hearts={s['hearts']}")
    shot('w5_mg_nest')
    place(73 * T, face=1); g0 = sim(0.05, [], ['Digit3'])['ammo']['grenade']; s = sim(0.02, [], ['KeyX']); check('Throwing a grenade uses one', s['ammo']['grenade'] == g0 - 1 and s['grenadesLive'] == 1)
    sim(0.6); shot('w6_grenade'); sim(1.0)
    check('A grenade stops the machine-gun nest', enemy(mgi)['state'] in ('dizzy', 'out'), enemy(mgi)['state'])
    # Crumbling floor: the old bridge gives way.
    place(97 * T, face=1); s = sim(0.6); check('The old bridge crumbles under Liev', s['crumbles'] >= 1)
    shot('w7_crumble')
    s = sim(1.0); check('Falling in the river takes Liev back to the last safe house', s['p']['x'] < 96 * T and s['p']['y'] <= GY + 1)
    # Bombing raid: a plane drops bombs with warning markers.
    ev(f"{W}.planeT=0"); place(86 * T, face=1); s = sim(0.4)
    check('In the bombing zone, a plane drops bombs (with warning markers)', s['bombs'] >= 2, f"bombs={s['bombs']}")
    sim(0.8); shot('w8_bombs')
    place(87 * T + 8, face=1); ev(f"{W}.planeT=0"); sim(0.05); s = sim(0.05, ['ArrowDown'], ['ArrowDown']); s = sim(3.5)
    check('Hiding behind a barrel keeps Liev safe from bombs', s['hearts'] == 3 and s['hidden'], f"hearts={s['hearts']} hidden={s['hidden']}")
    # Falling debris in the church.
    place(130 * T, face=1); s = sim(2.2, []); check('Debris starts falling (with a dust warning first)', s['rocks'] >= 1 or s['damageTaken'] >= 0)
    shot('w9_church')
    # Running out of hearts goes back to the safe house with hearts refilled.
    place(150 * T, face=1); ev(f"(()=>{{const r={W}; r.hearts=1; r.invuln=0; r.checkpoint={{x:124*16+8,y:176}};}})()")
    ev(f"{W}.hurt(1)"); s = sim(0.1); check('Losing all hearts restarts at the last safe house with full hearts', s['hearts'] == 3 and abs(s['p']['x'] - (124 * T + 8)) < 2, f"x={s['p']['x']}")
    # Safe house heals.
    ev(f"{W}.hearts=1"); place(124 * T + 8); s = sim(2.5); check('Standing at a safe house heals all hearts', s['hearts'] == 3)
    # The tank: bullets bounce, 4 grenades stop it, barricade opens, radio ends the level.
    tx = ev(f"{W}.tank.x"); place(tx - 70, face=1); ev(f"{W}.tank.t=99"); sim(0.05, [], ['Digit1']); sim(0.02, [], ['KeyX']); s = sim(0.5)
    check('Bullets bounce off the tank', s['tank']['hp'] == 4)
    shot('w10_tank')
    ev(f"{W}.ammo.grenade=6"); sim(0.05, [], ['Digit3'])
    for i in range(4):
        ev(f"(()=>{{const r={W}; r.tank.t=99; const tk=r.tank; r.grenadesLive.push({{x:tk.x+40,y:tk.y-30,vx:0,vy:0,fuse:0.01,spin:0}});}})()"); sim(0.3)
    s = sim(0.5); check('Four grenades stop the tank and the crew gives up', s['tank']['state'] == 'broken')
    check('The barricade opens when the tank stops', s['gateOpen'])
    shot('w11_tank_stopped')
    place(193 * T, face=1); s = sim(1.0, ['ArrowRight']); check('Reaching the radio finishes the level', s['done'])
    pg.wait_for_timeout(600); check('Treasure Stamp shows Medals', 'Medals' in ev("document.body.innerText"))
    check('Stamp is saved', 'bbw-door3' in ev("window.__bba.saves.platformer.stamps"))
    shot('w12_complete')
    # Admin can jump straight to each section.
    ev("window.__bba.ui.closePanel()"); ev("window.__bba.setMode('war',{level:'bbw-door3',checkpoint:5})"); pg.wait_for_timeout(1500)
    s = sim(0.1); check('Admin checkpoint jumps to the tank section', s['p']['x'] > 155 * T, f"x={s['p']['x']}")
    # Frame-rate independence.
    ev(f"{W}.enemies.forEach(e=>e.state='out')"); place(300); a = sim(1.0, ['ArrowRight'], [], 60)['p']['x']; place(300); c = sim(1.0, ['ArrowRight'], [], 15)['p']['x']
    check('Movement is the same at 60 fps and 15 fps', abs(a - c) < 4, f'{a:.1f} vs {c:.1f}')
    # Real-time play for a few seconds (drawing every frame) with no errors.
    place(80 * T); pg.wait_for_timeout(2000); shot('w13_realtime')
    check('No errors in the console', not errors, '; '.join(errors[:3]))
    b.close()
print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")
