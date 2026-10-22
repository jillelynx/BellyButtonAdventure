# Automated smoke test: loads the game, checks for errors, takes screenshots.
import sys, json, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))
    pg.goto(URL); pg.wait_for_timeout(4000)
    pg.screenshot(path=f"{OUT}/01_title.png")
    print("mode:", pg.evaluate("window.__bba && window.__bba.modeName"))
    print("\n".join(errors[:30]))
    b.close()
