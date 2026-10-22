# Automated play test for Belly Button Adventure.
# Runs the real game in a test browser, plays it with scripted "robot players",
# checks rules (no walking through things, camera never inside walls, saves work),
# and takes screenshots from fixed spots.
# Usage: python3 tests/play.py http://localhost:8765/ OUTPUT_FOLDER
import sys, json, math
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
results, errors = [], []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(3500)
    ev = pg.evaluate
    sim = lambda secs, keys=[], press=[]: ev(f"window.__bba.sim({secs}, {json.dumps(keys)}, {json.dumps(press)})")
    state = lambda: ev("window.__bba.state()")
    shot = lambda name: pg.screenshot(path=f"{OUT}/{name}.png")
    def wait_mode(m, ms=6000):
        for _ in range(ms // 100):
            if ev("window.__bba.modeName") == m and not ev("window.__bba.busy"): return True
            pg.wait_for_timeout(100)
        return False

    shot('01_title')
    check('Title screen shows', ev("window.__bba.modeName") == 'title')

    # ---- Character screen ----
    pg.click("text=Play"); check('Play opens character screen', wait_mode('select')); pg.wait_for_timeout(800)
    shot('02_select_liev_play')
    combos = [('soccer', 'everyday', False), ('soccer', 'styled', False), ('army', 'everyday', True), ('play', 'styled', True), ('play', 'everyday', True), ('army', 'styled', False)]
    for o, h, hat in combos:
        ev(f"(()=>{{const g=window.__bba; Object.assign(g.choice,{{player:'liev',outfit:'{o}',hair:'{h}',hat:{str(hat).lower()}}}); g.modes.title.rebuild(); g.modes.title.camZoom=2.6; g.modes.title.spin=0;}})()")
        pg.wait_for_timeout(500); shot(f'03_liev_{o}_{h}_{"hat" if hat else "nohat"}')
        ev("window.__bba.modes.title.spin=Math.PI"); pg.wait_for_timeout(400); shot(f'03_liev_{o}_{h}_{"hat" if hat else "nohat"}_back')
        ev("window.__bba.modes.title.spin=Math.PI/2"); pg.wait_for_timeout(400); shot(f'03_liev_{o}_{h}_{"hat" if hat else "nohat"}_left')
    ev("(()=>{const g=window.__bba; Object.assign(g.choice,{player:'bellybutton'}); g.modes.title.rebuild(); g.modes.title.camZoom=2.4; g.modes.title.spin=0;})()")
    pg.wait_for_timeout(500); shot('04_bellybutton_front')
    ev("window.__bba.modes.title.spin=Math.PI/2"); pg.wait_for_timeout(400); shot('04_bellybutton_side')
    # Back to Liev, play clothes, then start.
    ev("(()=>{const g=window.__bba; Object.assign(g.choice,{player:'liev',outfit:'play',hair:'everyday',hat:false}); g.saveLook(); g.modes.title.rebuild(); g.modes.title.camZoom=4.6;})()")
    ev("window.__bba.ui.closePanel()")
    ev("window.__bba.setMode('select',{mode:'select',after:'explore'})"); wait_mode('select'); pg.wait_for_timeout(500)
    pg.click("text=Let's go!"); check('Lets go starts exploration', wait_mode('explore'))
    pg.wait_for_timeout(1500); shot('05_bedroom_start')
    s = state(); check('Starts in the bedroom', s['area'] == 'bedroom', s['area'])

    # ---- Bedroom collisions ----
    BED = dict(minX=1.73, maxX=2.97, minZ=0.58, maxZ=2.97)
    def inside_bed(p, r=0.24): return BED['minX'] - r + 0.02 < p['x'] < BED['maxX'] + r - 0.02 and BED['minZ'] - r + 0.02 < p['z'] < BED['maxZ'] + r - 0.02 and p['y'] < 0.1
    bad = 0
    for (sx, sz, keys) in [(0.5, 1.8, ['KeyD']), (2.3, -1.2, ['KeyS']), (0.5, 0.2, ['KeyD', 'KeyS'])]:
        ev(f"(()=>{{const e=window.__bba.modes.explore; e.p.pos.set({sx},0,{sz}); e.cam.yaw=0; e.cam.manualT=0;}})()")
        for _ in range(30):
            s = sim(0.1, keys)
            if inside_bed(s['p']): bad += 1
        ev("window.__bba.modes.explore.cam.yaw=0")
    check('Cannot walk through the bed (3 directions)', bad == 0, f'{bad} bad frames')
    for _ in range(3): s = sim(0.5, ['KeyD', 'ShiftLeft'])
    # Run hard into each wall at a low frame rate (slow computer) too.
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(0,0,0); e.cam.yaw=0;})()")
    worst = 0
    for keys in (['KeyW', 'ShiftLeft'], ['KeyA', 'ShiftLeft'], ['KeyS', 'ShiftLeft'], ['KeyD', 'KeyW', 'ShiftLeft']):
        s = ev(f"window.__bba.sim(1.5, {json.dumps(keys)}, [], 12)")
        worst = max(worst, abs(s['p']['x']), abs(s['p']['z']))
    check('Stays inside the room walls (even at 12 fps)', worst < 2.97, f'max |x|,|z| = {worst:.2f}')
    # Camera never leaves the room.
    cam_bad = 0
    for yaw in [0, 1.2, 2.5, 3.6, 4.8]:
        ev(f"(()=>{{const e=window.__bba.modes.explore; e.p.pos.set(-2.6,0,-2.6); e.cam.yaw={yaw}; e.cam.pitch=0.6; e.cam.dist=7; e.cam.manualT=0;}})()")
        s = sim(0.6)
        c = s['cam']
        if not (-2.95 < c['x'] < 2.95 and 0.05 < c['y'] < 2.85 and -2.95 < c['z'] < 2.95): cam_bad += 1
    check('Camera stays inside the bedroom', cam_bad == 0, f'{cam_bad} bad')
    # Friend is solid and steps aside.
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(-1,0,1.5); e.f.pos.set(-1,0,0.6); e.f.vy=0; e.f.onGround=true; e.p.vy=0; e.cam.yaw=0; e.cam.manualT=0;})()")
    min_d = 9; trace = []
    for _ in range(20):
        s = sim(0.05, ['KeyW'])
        d = math.hypot(s['p']['x'] - s['f']['x'], s['p']['z'] - s['f']['z']); trace.append((round(s['p']['x'],2), round(s['p']['z'],2), round(s['p']['y'],2), round(s['f']['x'],2), round(s['f']['z'],2), round(s['f']['y'],2), round(d,2)))
        min_d = min(min_d, d)
    if min_d <= 0.44: print(trace)
    check('Player cannot walk through the friend', min_d > 0.44, f'closest {min_d:.2f}m')
    # Jump onto the bed.
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(1.2,0,1.6); e.p.yaw=Math.PI/2; e.cam.yaw=-Math.PI/2; e.cam.manualT=0;})()")
    sim(0.05, ['KeyW', 'Space'], ['Space']); s = sim(0.6, ['KeyW', 'Space'])
    check('Can jump up onto the bed', s['p']['y'] > 0.5, f"y={s['p']['y']:.2f}")
    sim(0.6)
    # ---- The map magic ----
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(-0.2,0,-2.0); e.p.yaw=Math.PI; e.cam.yaw=0; e.f.pos.set(0.8,0,-1.4); e.p.vy=0;})()")
    sim(0.2)
    prompt = ev("document.querySelector('#prompt').textContent")
    check('Prompt appears at the map', 'map' in prompt.lower(), prompt.strip())
    shot('06_bedroom_map_prompt')
    sim(0.05, [], ['KeyE']); sim(1.2); shot('07_map_magic')
    sim(1.5); pg.wait_for_timeout(1600)
    s = state(); check('Map magic takes you to Belly Button\'s World', s['area'] == 'bbworld', s['area'])
    check('Belly Button\'s World is saved as unlocked', s['saves']['explore']['unlocked']['bbworld'])
    shot('08_bbworld_arrival')

    # ---- Belly Button's World ----
    # Walk the stitched path to the door (holding forward, camera behind).
    found = False
    for i in range(80):
        s = ev("(()=>{const e=window.__bba.modes.explore; const tx=0, tz=-18.2; const dx=tx-e.p.pos.x, dz=tz-e.p.pos.z; e.cam.yaw=Math.atan2(-dx,-dz); e.cam.manualT=0; return window.__bba.sim(0.15,['KeyW','ShiftLeft']);})()")
        if 'bbw-door1' in s['saves']['explore']['doorsFound']: found = True
        if math.hypot(s['p']['x'], s['p']['z'] + 18.3) < 0.6: break
    check('Walking toward the hill discovers the Doodle Door', found)
    sim(0.6); pg.wait_for_timeout(300); shot('09_bbworld_door')
    prompt = ev("document.querySelector('#prompt').textContent")
    check('Door prompt appears', 'doodle door' in prompt.lower(), prompt.strip())
    # Camera above the ground everywhere on a spin.
    under = 0
    for yaw in [0, 1, 2, 3, 4, 5]:
        ev(f"(()=>{{const e=window.__bba.modes.explore; e.cam.yaw={yaw}; e.cam.pitch=-0.1; e.cam.dist=7; e.cam.manualT=0;}})()")
        s = sim(0.4)
        h = ev(f"window.__bba.modes.explore.area.terrain({s['cam']['x']},{s['cam']['z']})")
        if s['cam']['y'] < h + 0.2: under += 1
    check('Camera never goes under the ground', under == 0, f'{under} bad')
    # Trees are solid.
    t = ev("(()=>{const c=window.__bba.modes.explore.area.circles.find(c=>c.r===0.3); return c;})()")
    ev(f"(()=>{{const e=window.__bba.modes.explore; e.p.pos.set({t['x']}+2,e.area.terrain({t['x']}+2,{t['z']}),{t['z']}); e.cam.yaw=Math.PI/2; e.cam.manualT=0;}})()")
    md = 9
    for _ in range(25):
        s = ev("window.__bba.sim(0.08,['KeyW','ShiftLeft'],[],12)")
        md = min(md, math.hypot(s['p']['x'] - t['x'], s['p']['z'] - t['z']))
    check('Cannot walk through a tree trunk (fast, 12 fps)', md >= 0.53, f'closest {md:.2f}')
    # The edge of the world.
    ev("(()=>{const e=window.__bba.modes.explore; e.p.pos.set(30,e.area.terrain(30,0),0); e.cam.yaw=-Math.PI/2; e.cam.manualT=0;})()")
    mr = 0
    for _ in range(30):
        s = ev("window.__bba.sim(0.1,['KeyW','ShiftLeft'])"); mr = max(mr, math.hypot(s['p']['x'], s['p']['z']))
    edge = ev("document.querySelector('#edge').textContent")
    check('World edge holds you in, with a gentle message', mr <= 39.01 and 'pillow' in edge.lower(), f'max r {mr:.2f}')
    shot('10_bbworld_edge')
    # Map screen + travel to the door.
    ev("window.__bba.ui.closePanel()"); pg.keyboard.press('m'); pg.wait_for_timeout(500); shot('11_map_screen')
    chip = pg.query_selector('.door-chip'); check('Found door is listed on the map', chip is not None)
    if chip: chip.click(); pg.wait_for_timeout(1200)
    s = state(); check('Clicking the door on the map travels there', s['area'] == 'bbworld' and math.hypot(s['p']['x'], s['p']['z'] + 18.3) < 1.0, f"{s['p']['x']:.1f},{s['p']['z']:.1f}")
    # Through the door.
    sim(0.05, [], ['KeyE']); check('Door opens the platformer', wait_mode('platformer')); pg.wait_for_timeout(1200)
    shot('12_platformer_start')

    # ---- Platformer bot ----
    BOT = """(kind)=>{
      const g=window.__bba, pl=g.modes.platformer; const L=pl.def; let log=[];
      const S=()=>g.state();
      const run=(secs,keys,press=[])=>g.sim(secs,keys,press);
      let s=S(), t=0, kicked=0, hold=0;
      while(t<90 && !s.done){
        const p=s.p; let keys=['ArrowRight']; let press=[];
        // Jump at the end of a block, or when blocked by a step.
        const edges=[17.4,21.4,25.5,55.55];
        if(p.onGround && (edges.some(e=>p.x>e-0.35 && p.x<e+0.2) || (Math.abs(p.vx)<0.3 && t>0.5 && !(kind==='liev' && p.x>39 && p.x<41)))) press.push('Space');
        if(kind==='liev'){
          if(p.x>53.6 && p.x<54.8 && p.onGround && p.y>=4.9 && !s.bridge && kicked<3){ run(0.3,[]); run(0.05,[],['KeyX']); kicked++; run(1.5,[]); s=S(); t+=1.85; continue; }
          if(p.x>55 && p.x<56 && !s.bridge){ press=press.filter(k=>k!=='Space'); }
        } else {
          if(p.onGround && p.x>34.6 && p.x<35.4 && p.y<4.5) press.push('Space');
          if(!p.onGround && p.vy<0 && p.x>35.2 && p.x<38.4 && p.y>5 && p.y<9 && !p.diving) press.push('ArrowDown');
          if(p.x>54) keys.push('Space');
        }
        if(press.includes('Space')) hold=0.35;
        s=run(0.05, hold>0? [...keys,'Space']:keys, press); t+=0.05; hold-=0.05;
        if(log.length<400 && Math.round(t*20)%10===0) log.push([+s.p.x.toFixed(1),+s.p.y.toFixed(1),s.checkpoint]);
      }
      return {done:s.done, t, x:s.p.x, y:s.p.y, collected:s.collected, bridge:s.bridge, log:log.slice(-40)};
    }"""
    r = ev(f"({BOT})('liev')")
    check('Liev can finish the level (climb + kick bridge)', r['done'] and r['bridge'], f"t={r['t']:.1f}s x={r['x']:.1f} y={r['y']:.1f} buttons={r['collected']}")
    if not r['done']: print(r['log'])
    pg.wait_for_timeout(800); shot('13_platformer_complete')
    s = state(); check('Stamp saved in the platformer save slot', 'bbw-door1' in s['saves']['platformer']['stamps'])
    pg.click("button:has-text('Back to')"); check('Back button returns to exploration', wait_mode('explore')); pg.wait_for_timeout(800)
    s = state(); check('Returned in front of the door', s['area'] == 'bbworld' and math.hypot(s['p']['x'], s['p']['z'] + 18.3) < 1.0)
    # Now as Belly Button.
    sim(0.05, [], ['KeyC']); s = state(); check('C swaps to Belly Button', s['player'] == 'bellybutton')
    sim(0.3); shot('14_bbworld_as_bellybutton')
    sim(0.05, [], ['KeyE']); wait_mode('platformer'); pg.wait_for_timeout(800)
    r = ev(f"({BOT})('bb')")
    check('Belly Button can finish the level (belly bounce + float)', r['done'] and not r['bridge'], f"t={r['t']:.1f}s x={r['x']:.1f} y={r['y']:.1f} buttons={r['collected']}")
    if not r['done']: print(r['log'])
    # Liev cannot cross the big gap without the bridge (abilities really matter).
    ev("window.__bba.setMode('platformer',{level:'bbw-door1',checkpoint:2,returnTo:{area:'bbworld'}})"); wait_mode('platformer')
    ev("(()=>{const g=window.__bba; g.choice.player='liev';})()")
    ev("window.__bba.setMode('platformer',{level:'bbw-door1',checkpoint:2,returnTo:{area:'bbworld'}})"); wait_mode('platformer')
    ev("(()=>{const p=window.__bba.modes.platformer.p; p.x=55.2;})()")
    s = sim(0.05, ['ArrowRight', 'ShiftLeft', 'Space'], ['Space']); s = sim(1.6, ['ArrowRight', 'ShiftLeft', 'Space'])
    check('Without the bridge, Liev falls and gently respawns at the flag', s['p']['x'] < 56 and s['checkpoint'] == 2, f"x={s['p']['x']:.1f}")
    shot('15_platformer_mid')
    # Screenshot at the chalk wall and cushion.
    ev("(()=>{const p=window.__bba.modes.platformer; p.p.x=37; p.p.y=4.45; p.camPos.set(39,8,13); p.camLook.set(39,6,0);})()"); sim(0.6); pg.wait_for_timeout(300); shot('16_platformer_wall')

    # ---- Saves survive a reload ----
    ev("window.__bba.leaveLevel()"); wait_mode('explore'); pg.wait_for_timeout(500)
    ev("window.__bba.modes.explore.saveNow()")
    pg.reload(); pg.wait_for_timeout(3500)
    s = state()
    check('After reload: map unlocked, door found and stamp kept', s['saves']['explore']['unlocked']['bbworld'] and 'bbw-door1' in s['saves']['explore']['doorsFound'] and 'bbw-door1' in s['saves']['platformer']['stamps'])
    pg.click("text=Keep playing"); wait_mode('explore'); pg.wait_for_timeout(800)
    s = state(); check('Keep playing returns to Belly Button\'s World', s['area'] == 'bbworld')
    # ---- Admin panel ----
    pg.keyboard.type('bigbutton'); pg.wait_for_timeout(2500)
    check('Typing the secret word opens the admin panel', pg.query_selector('.admin') is not None)
    shot('17_admin')
    pg.click("text=Liev's Room"); pg.wait_for_timeout(1500)
    s = state(); check('Admin can travel anywhere', s['area'] == 'bedroom')
    # ---- Pause menu buttons respond ----
    pg.keyboard.press('Escape'); pg.wait_for_timeout(1500)
    check('Esc opens the pause menu', pg.query_selector("text=Keep playing") is not None)
    shot('18_pause'); pg.click("text=Settings"); pg.wait_for_timeout(300); shot('19_settings')
    pg.click("text=Back"); pg.wait_for_timeout(200); pg.click("text=Keep playing"); pg.wait_for_timeout(200)
    check('Pause menu closes and game resumes', not ev("window.__bba.paused"))
    # HUD buttons are clickable (nothing invisible covering them).
    pg.click("#hud-right [data-act=map]"); pg.wait_for_timeout(300)
    check('HUD Map button responds to clicks', pg.query_selector('.map-box') is not None)
    pg.click("text=Close map")
    # ================= PHASE 1 CHECKS =================
    # Menu colors on the title screen.
    ev("window.__bba.setMode('title')"); wait_mode('title'); pg.wait_for_timeout(800)
    cols = ev("[...document.querySelectorAll('.title-wrap .btn')].map(b=>getComputedStyle(b).backgroundColor)")
    check('Main menu buttons each have their own color', len(cols) >= 3 and len(set(cols)) == len(cols), str(cols))
    icons = ev("document.querySelectorAll('.title-wrap .btn .ico').length")
    check('Main menu buttons have pictures', icons == len(cols), f'{icons} icons')
    shot('20_title_colors')
    # Esc backs out of Settings on the title screen.
    pg.click("text=Settings"); pg.wait_for_timeout(400); pg.keyboard.press('Escape'); pg.wait_for_timeout(1500)
    check('Esc goes back from Settings to the title', pg.query_selector('.title-wrap') is not None)
    # Character screen has a Go back button, and Esc works there.
    ev("window.__bba.setMode('select',{mode:'select',after:'explore'})"); wait_mode('select'); pg.wait_for_timeout(600)
    check('Character screen has a Go back button', pg.query_selector("button:has-text('Go back')") is not None)
    shot('21_select_goback')
    # Admin panel opened and closed on the character screen keeps its buttons.
    pg.keyboard.type('bigbutton'); pg.wait_for_timeout(2500)
    opened = pg.query_selector('.admin') is not None
    pg.click(".admin [data-act=close]"); pg.wait_for_timeout(600)
    check('Closing admin on the character screen brings its buttons back', opened and pg.query_selector("button:has-text(\"Let's go!\")") is not None)
    pg.click("button:has-text('Go back')"); check('Go back returns to the title', wait_mode('title'))
    # Map opened from the pause menu returns to the pause menu.
    ev("window.__bba.setMode('explore',{area:'bbworld'})"); wait_mode('explore'); pg.wait_for_timeout(800)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(1500); pg.click(".panel [data-act=map]"); pg.wait_for_timeout(500)
    pg.click("text=Close map"); pg.wait_for_timeout(400)
    check('Closing the map from the pause menu returns to the pause menu', pg.query_selector("text=Paused") is not None)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(1500)
    check('Esc closes the pause menu', not ev("window.__bba.paused"))
    # A mode switch that breaks never leaves a blank screen.
    ev("(()=>{const g=window.__bba; const orig=g.modes.platformer.enter; g.modes.platformer.enter=()=>{ g.modes.platformer.enter=orig; throw new Error('test break'); }; g.setMode('platformer',{level:'bbw-door1'});})()")
    pg.wait_for_timeout(3000)
    check('If switching modes breaks, the game goes safely back to the title', ev("window.__bba.modeName") == 'title' and pg.query_selector('.title-wrap') is not None and ev("getComputedStyle(document.querySelector('#fade')).opacity") == '0')
    errors[:] = [e for e in errors if 'test break' not in e]

    # Timer: off by default; when on, starts only on the first move.
    check('Timer is off by default', ev("window.__bba.settings.timer") is False)
    ev("(()=>{const g=window.__bba; g.settings.timer=true; g.choice.player='liev'; g.setMode('platformer',{level:'bbw-door1',returnTo:{area:'bbworld'}});})()"); wait_mode('platformer'); pg.wait_for_timeout(800)
    s = sim(1.0)
    check('Timer waits for the first move', s['timer']['on'] and not s['timer']['started'] and s['timer']['t'] == 0)
    s = sim(0.5, ['ArrowRight'])
    check('Timer starts when you move', s['timer']['started'] and s['timer']['t'] > 0.3, f"{s['timer']['t']:.2f}s")
    shot('22_timer_on')
    # Rest spot: stand still on it to rest and get a treat, only once per run.
    ev("(()=>{const pl=window.__bba.modes.platformer; pl.p.x=30; pl.p.y=4; pl.p.vx=0; pl.p.vy=0;})()")
    s = sim(0.3)
    cp = s['checkpoint']
    s = sim(2.5)
    check('Resting on a rest spot gives a treat', s['treats'] == 1, f"treats={s['treats']}")
    check('The rest spot is also a checkpoint', cp == 1, f'checkpoint={cp}')
    s = sim(3.0)
    check('Each rest spot works only once per run', s['treats'] == 1, f"treats={s['treats']}")
    ev("(()=>{const pl=window.__bba.modes.platformer; pl.camPos.set(31,6.5,10.5); pl.camLook.set(31,5,0);})()"); sim(0.3); pg.wait_for_timeout(400); shot('23_rest_spot')
    # Falling into a pit puts you back at the last rest spot.
    ev("(()=>{const pl=window.__bba.modes.platformer; pl.p.x=27.5; pl.p.y=4.5; pl.p.vy=0;})()")
    s = sim(1.5)
    check('Falling returns you to the last rest spot', abs(s['p']['x'] - 30) < 0.5, f"x={s['p']['x']:.1f}")
    # Finish with the timer on: best time saved and celebrated.
    r = ev(f"({BOT})('liev')")
    s = state()
    best = ev("JSON.parse(localStorage.getItem('bba.records')||'{}')")
    check('With the timer on, finishing saves a best time', r['done'] and 'bbw-door1' in best.get('bestTimes', {}), str(best))
    pg.wait_for_timeout(800)
    check('A new best time shows a celebration', pg.query_selector('.record') is not None)
    shot('24_new_record')
    pg.keyboard.press('Escape'); check('Esc on the end-of-level screen goes back to the world', wait_mode('explore'))
    ev("window.__bba.settings.timer=false; window.__bba.saveSettings()")
    fps = ev("window.__bba.fpsNow")
    print(f"(Test-browser speed: {fps:.1f} fps in software drawing mode — NOT a measure of your Mac.)")
    b.close()

print('\nJavaScript errors:', len(errors)); print('\n'.join(errors[:20]))
fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed")
