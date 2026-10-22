# Automated checks for the retro pixel level (Pixel Peaks).
# Usage: python3 tests/retro_test.py http://localhost:8765/ OUTPUT_FOLDER
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]
results, errors = [], []
def check(name, ok, detail=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("console", lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2500)
    ev = pg.evaluate
    sim = lambda secs, keys=[], press=[], fps=60: ev(f"window.__bba.sim({secs}, {json.dumps(keys)}, {json.dumps(press)}, {fps})")
    def place(x, y=176, **kw):
        extra = ''.join(f"r.p.{k}={json.dumps(v)};" for k, v in kw.items())
        ev(f"(()=>{{const r=window.__bba.modes.retro; r.p.x={x}; r.p.y={y}; r.p.vx=0; r.p.vy=0; r.p.sliding=0; r.p.action=null; r.p.h=44; {extra} r.camX=Math.max(0,{x}-r.vw*0.38);}})()")
    # Enter the way a player does: walk up to the green Pixel Door in Belly Button's World and press E.
    ev("(()=>{const g=window.__bba; g.choice.player='liev'; g.saves.explore.unlocked.bbworld=true; g.saves.explore.started=true; g.setMode('explore',{area:'bbworld'});})()"); pg.wait_for_timeout(2500)
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(-14, e.area.terrain(-14,17.8), 17.8); e.p.yaw=Math.PI; e.cam.yaw=0;})()")
    sim(0.3); found = ev("window.__bba.saves.explore.doorsFound.includes('bbw-door2')")
    check('Walking up to the green Pixel Door discovers it', found)
    ev("window.__bba.simulating=false"); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/r0_pixel_door.png')
    sim(0.05, [], ['KeyE']); pg.wait_for_timeout(2500)
    check('Retro level opens', ev("window.__bba.modeName") == 'retro')
    check("Liev's sprite sheet loads", ev("window.__bbaSprite.ready === true"))
    check('Pixels stay crisp (no smoothing, whole-number scale)', ev("(()=>{const r=window.__bba.modes.retro; return r.ctx.imageSmoothingEnabled===false && Number.isInteger(r.scale) && getComputedStyle(r.canvas).imageRendering.includes('pixel');})()"))
    s = sim(0.5); check('Standing still plays idle', s['anim']['name'] == 'idle' and s['anim']['row'] == 0)
    s = sim(0.4, ['ArrowRight']); check('Walking plays the walk cycle', s['anim']['name'] == 'walk' and s['anim']['row'] == 1, str(s['anim']))
    s = sim(0.6, ['ArrowRight', 'ShiftLeft']); check('Shift + arrow plays the run cycle', s['anim']['name'] == 'run' and s['anim']['row'] == 5, str(s['anim']))
    s = sim(0.4, []); place(150)
    s = sim(0.05, ['Space'], ['Space']); s2 = sim(0.15, ['Space']); check('Jumping uses the jump frames while rising', s2['anim']['row'] == 6 and s2['p']['vy'] < 0, str(s2['anim']))
    s = sim(0.9); check('Lands back on the ground', s['p']['onGround'] and abs(s['p']['y'] - 176) < 0.5)
    # Same distance walked at 60 fps and at 15 fps (animation and movement don't depend on computer speed).
    place(150); a = sim(1.0, ['ArrowRight'], [], 60)['p']['x']; place(150); c = sim(1.0, ['ArrowRight'], [], 15)['p']['x']
    check('Movement is the same at 60 fps and 15 fps', abs(a - c) < 4, f'{a:.1f} vs {c:.1f}')
    # Quick direction changes don't break anything.
    place(400)
    for _ in range(12): sim(0.05, ['ArrowLeft']); sim(0.05, ['ArrowRight'])
    s = sim(0.3); check('Rapid left-right changes stay on the ground and settle', s['p']['onGround'] and s['anim']['name'] in ('idle', 'walk', 'land'))
    # Fallen log: too low to walk under standing, but you can slide or crawl through.
    place(660); s = sim(1.5, ['ArrowRight'])
    check('Cannot walk under the log standing up', s['p']['x'] < 44 * 16 - 7, f"x={s['p']['x']:.1f}")
    place(660); s = sim(1.2, ['ArrowRight', 'Space'])
    check('Cannot jump over the rock wall', s['p']['x'] < 44 * 16, f"x={s['p']['x']:.1f}")
    place(600, face=1); sim(0.35, ['ArrowRight', 'ShiftLeft']); s = sim(0.05, ['ArrowRight', 'ShiftLeft', 'ArrowDown'], ['ArrowDown']); s = sim(1.5, ['ArrowRight', 'ShiftLeft', 'ArrowDown'])
    check('Sliding gets under the log', s['p']['x'] > 50 * 16, f"x={s['p']['x']:.1f}")
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')
    place(700, face=1); s = sim(0.05, ['ArrowDown']); s = sim(3.2, ['ArrowRight', 'ArrowDown'])
    check('Crawling (hold ↓) also gets under the log', s['p']['x'] > 50 * 16, f"x={s['p']['x']:.1f}")
    s = sim(0.6); check('Stands back up after the log', s['p']['h'] == 44 and not s['p']['ducking'])
    # Slide pose captured mid-slide.
    place(600, face=1); sim(0.35, ['ArrowRight', 'ShiftLeft']); s = sim(0.05, ['ArrowRight', 'ShiftLeft', 'ArrowDown'], ['ArrowDown']); s = sim(0.15, ['ArrowRight', 'ShiftLeft', 'ArrowDown'])
    check('Slide uses the slide frames', s['anim']['name'] == 'slide' and s['anim']['row'] == 2 and s['anim']['col'] >= 2, str(s['anim']))
    ev("window.__bba.simulating=false"); pg.wait_for_timeout(400); shot('r1_slide')
    # Punch a crate: it breaks and gives a star.
    place(52 * 16 + 2, face=1); before = sim(0.05)['stars']
    s = sim(0.05, [], ['KeyZ']); s = sim(0.7)
    check('Punching a crate breaks it and gives a star', s['stars'] == before + 1, f"{before}->{s['stars']}")
    # Bump a ? box from below.
    place(27 * 16 + 8); before = sim(0.05)['stars']; sim(0.05, ['Space'], ['Space']); s = sim(0.8, ['Space'])
    check('Jumping into a ? box from below gives a star', s['stars'] >= before + 1, f"{before}->{s['stars']}")
    # The gate blocks the way until you score a goal.
    place(87 * 16); s = sim(1.5, ['ArrowRight', 'ShiftLeft'])
    check('The gate blocks the path before scoring', s['p']['x'] < 90 * 16 - 7 and not s['gateOpen'], f"x={s['p']['x']:.1f}")
    ev("(()=>{const r=window.__bba.modes.retro; r.ball.x=r.ballStart.x; r.ball.y=r.ballStart.y; r.ball.vx=0; r.ball.vy=0;})()")
    bx = ev("window.__bba.modes.retro.ballStart.x"); place(bx - 14, face=1); sim(0.3)
    s = sim(0.05, [], ['KeyX']); s = sim(0.25)
    check('Kicking plays the kick frames', s['anim']['name'] == 'kick' and s['anim']['row'] == 3, str(s['anim']))
    ev("window.__bba.simulating=false"); pg.wait_for_timeout(300); shot('r2_kick')
    s = sim(2.5)
    check('Kicking the ball into the goal opens the gate', s['gateOpen'], f"ball at {s['ball']['x']:.0f}")
    place(87 * 16); s = sim(1.5, ['ArrowRight', 'ShiftLeft'])
    check('After the goal you can go through the gate', s['p']['x'] > 91 * 16, f"x={s['p']['x']:.1f}")
    # Water: falling in sends you back to the last rest spot.
    place(94 * 16 + 8); sim(0.2)
    place(131 * 16, 150); s = sim(1.0)
    check('Falling in the water returns you to the last rest spot', abs(s['p']['x'] - (94 * 16 + 8)) < 2, f"x={s['p']['x']:.1f}")
    # Rest spot gives a treat once.
    t0 = s['treats']; s = sim(2.5); t1 = s['treats']; s = sim(2.5)
    check('Resting at a rest spot gives one treat, only once', t1 == t0 + 1 and s['treats'] == t1, f'{t0}->{t1}->{s["treats"]}')
    # Run and jump across the last pond, then reach the Treasure Stamp.
    place(127 * 16); s = sim(0.4, ['ArrowRight', 'ShiftLeft']); s = sim(0.05, ['ArrowRight', 'ShiftLeft', 'Space'], ['Space']); s = sim(0.9, ['ArrowRight', 'ShiftLeft', 'Space'])
    check('A running jump clears the last pond', s['p']['x'] > 134 * 16 and s['p']['y'] <= 176.5, f"x={s['p']['x']:.1f} y={s['p']['y']:.1f}")
    s = sim(4.0, ['ArrowRight'])
    check('Reaching the Treasure Stamp finishes the level', s['done'])
    check('The stamp is saved in the platformer save slot', 'bbw-door2' in s['saves']['platformer']['stamps'])
    ev("window.__bba.simulating=false"); pg.wait_for_timeout(1200); shot('r3_complete')
    pg.click("button:has-text('Back to')"); pg.wait_for_timeout(3000)
    st = ev("window.__bba.state()")
    check('Back button returns to the green Pixel Door', st['mode'] == 'explore' and abs(st['p']['x'] + 14) < 1.2 and abs(st['p']['z'] - 17.7) < 1.2, f"{st['p']['x']:.1f},{st['p']['z']:.1f}")
    pg.wait_for_timeout(800); shot('r4_pixel_door')
    b.close()
print('\nJavaScript errors:', len(errors)); print('\n'.join(errors[:10]))
print(f"{sum(r[1] for r in results)} passed, {sum(not r[1] for r in results)} failed")
