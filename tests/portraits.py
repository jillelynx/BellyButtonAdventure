# Close-up screenshots of each character option, from fixed camera spots,
# for checking against the reference photos.
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":900,"height":900}); pg.goto(URL); pg.wait_for_timeout(2500)
    ev = pg.evaluate
    ev("window.__bba.setMode('select',{mode:'select'})"); pg.wait_for_timeout(1500)
    ev("document.querySelector('#screen').style.display='none'")
    def setc(c):
        ev(f"(()=>{{const g=window.__bba; Object.assign(g.choice,{json.dumps(c)}); const st=g.modes.title; st.rebuild(); st.spin=0; st.side.root.visible=false;}})()")
    def cam(pos, look, spin, name):
        ev(f"(()=>{{const st=window.__bba.modes.title; st.debugCam=[{pos},{look}]; st.spin={spin};}})()"); pg.wait_for_timeout(700); pg.screenshot(path=f"{OUT}/{name}.png")
    looks = [dict(player='liev',outfit='play',hair='everyday',hat=False), dict(player='liev',outfit='soccer',hair='styled',hat=False), dict(player='liev',outfit='army',hair='everyday',hat=True), dict(player='liev',outfit='play',hair='styled',hat=True)]
    for i, c in enumerate(looks):
        setc(c)
        tag = f"{c['outfit']}_{c['hair']}_{'hat' if c['hat'] else 'nohat'}"
        cam("[0,0.85,3.2]", "[0,0.78,0.2]", 0, f"p{i}_{tag}_full_front")
        cam("[0,0.85,3.2]", "[0,0.78,0.2]", 3.1416, f"p{i}_{tag}_full_back")
        cam("[0,1.34,1.05]", "[0,1.33,0.2]", 0, f"p{i}_{tag}_face")
        cam("[0,1.34,1.05]", "[0,1.33,0.2]", -1.5708, f"p{i}_{tag}_face_left")
        cam("[0,1.34,1.05]", "[0,1.33,0.2]", 3.1416, f"p{i}_{tag}_face_back")
    setc(dict(player='bellybutton'))
    cam("[0,0.6,2.4]", "[0,0.5,0.2]", 0, "bb_front")
    cam("[0,0.6,2.4]", "[0,0.5,0.2]", 0.7, "bb_3q")
    cam("[0,0.85,1.1]", "[0,0.82,0.2]", 0, "bb_face")
    b.close()
