#!/usr/bin/env python3
"""Make a 1340 x 800 calibration image (docs/calibration_1340x800.png).

Show it full-screen on the tablet with the bezel fitted: the green frames
should sit just inside the two windows, and every red area (pop-out title
bars, taskbar, divider) should be hidden by the bezel. If not, adjust
scr_offset / the borders in the .scad and rebuild.
"""
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
info = json.loads((ROOT / "build" / "info.json").read_text())
PW, PH = 1340, 800
pfd, nd = info["pfd_px"], info["nd_px"]

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
try:
    f_big, f_small = ImageFont.truetype(FONT, 26), ImageFont.truetype(FONT, 15)
except OSError:
    f_big = f_small = ImageFont.load_default()

im = Image.new("RGB", (PW, PH), (0, 0, 0))
d = ImageDraw.Draw(im)
for x in range(0, PW, 50):
    d.line([(x, 0), (x, PH)], fill=(28, 28, 32) if x % 100 else (45, 45, 52))
for y in range(0, PH, 50):
    d.line([(0, y), (PW, y)], fill=(28, 28, 32) if y % 100 else (45, 45, 52))

red = (190, 30, 30)


def hatch(x0, y0, x1, y1, text=None):
    d.rectangle([x0, y0, x1, y1], fill=(60, 8, 8))
    for k in range(int(x0) - int(y1 - y0), int(x1), 14):
        d.line([(max(k, x0), y0 + max(0, x0 - k)), (min(k + (y1 - y0), x1), y1 - max(0, k + (y1 - y0) - x1))], fill=red, width=2)
    if text:
        d.text(((x0 + x1) / 2, (y0 + y1) / 2), text, font=f_small, fill=(255, 210, 210), anchor="mm",
               stroke_width=3, stroke_fill=(60, 8, 8))


top, bot = round(pfd[1]), round(pfd[3])
hatch(0, 0, PW - 1, top - 1, f"HIDDEN BY 15 mm TOP BORDER  (rows 0-{top - 1}: pop-out title bars)")
hatch(0, bot + 1, PW - 1, PH - 1, f"HIDDEN BY 15 mm BOTTOM BORDER  (rows {bot + 1}-799: taskbar)")
hatch(round(pfd[2]) + 1, top, round(nd[0]) - 1, bot)

green = (40, 230, 90)
for name, r in (("PFD", pfd), ("ND", nd)):
    x0, y0, x1, y1 = round(r[0]), round(r[1]), round(r[2]), round(r[3])
    d.rectangle([x0 + 3, y0 + 3, x1 - 3, y1 - 3], outline=green, width=3)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    d.line([(cx - 20, cy), (cx + 20, cy)], fill=green, width=2)
    d.line([(cx, cy - 20), (cx, cy + 20)], fill=green, width=2)
    d.text((cx, cy - 70), name, font=f_big, fill=(255, 255, 255), anchor="mm")
    d.text((cx, cy + 50), f"x {x0}-{x1}   y {y0}-{y1}", font=f_small, fill=(200, 255, 210), anchor="mm")
    d.text((cx, cy + 74), f"{x1 - x0} x {y1 - y0} px", font=f_small, fill=(200, 255, 210), anchor="mm")
d.text(((pfd[0] + pfd[2]) / 2, bot - 26), "aligned = green frames just inside the windows, no red visible", font=f_small,
       fill=(170, 170, 170), anchor="mm")

out = ROOT / "docs" / "calibration_1340x800.png"
im.save(out)
print(f"wrote {out.relative_to(ROOT)}")
