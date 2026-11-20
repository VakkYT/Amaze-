#!/usr/bin/env python3
"""Dimensioned technical drawing (2 x A3 landscape) generated from the exported
STLs and build/info.json:  python3 tools/drawing.py
Output: docs/technical_drawing.pdf (+ PNG of each sheet).
Views are cut from the real meshes, so the drawing always matches the model.
"""
import json
import math
import pathlib
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Arc, Circle, PathPatch, Rectangle
from matplotlib.path import Path
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parent.parent
info = json.loads((ROOT / "build" / "info.json").read_text())
W, H, T, R = info["tablet"]
clr_xy, clr_z = info["clearance"]
wall, o = info["wall"]
z_floor, z_tab_b, z_tab_f, z_rim, bezel_t, bezel_top, crown_h, shell_h = info["z"]
pfd, nd = info["pfd"], info["nd"]
div_cx, div_w, div_w_top, div_h = info["divider"]
out_w, out_h, total_d = info["outer"]
scr_x0, scr_y0, scr_w, scr_h, px_mm = info["screen_mm"]

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 6.5, "lines.solid_capstyle": "butt"})
LW, THIN, HAIR = 0.55, 0.28, 0.18
INK, CUT = "#111111", "#d9dde2"


def load(rel, dz=0.0, matrix=None):
    m = trimesh.load(ROOT / rel, force="mesh")
    if dz:
        m.apply_translation([0, 0, dz])
    if matrix is not None:
        m.apply_transform(matrix)
    return m


bezel = load("stl/front_bezel_PLA.stl")
bezel_c = load("stl/front_bezel_PLA.stl", z_rim)
shell = load("stl/rear_housing_PLA.stl")
tablet = load("build/tablet_dummy.stl")
tpu = load("stl/tpu_liner_TPU_optional.stl", z_floor + info["ribs"][2])
stand = load("stl/desk_stand_PLA.stl")


def section(mesh, axis, value):
    normal = {"x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]}[axis]
    origin = [value if a == axis else 0 for a in "xyz"]
    sec = mesh.section(plane_origin=origin, plane_normal=normal)
    if sec is None:
        return Polygon()
    if axis == "z":
        M = np.eye(4); M[2, 3] = -value
    elif axis == "x":
        M = np.array([[0, 1, 0, 0], [0, 0, 1, 0], [1, 0, 0, -value], [0, 0, 0, 1]], float)
    else:
        M = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, value], [0, 0, 0, 1]], float)
    p2, _ = sec.to_2D(to_2D=M)
    return unary_union(p2.polygons_full)


def assembly_matrix():
    th = math.radians(info["stand"][0]); s_c = info["stand"][2]
    def rx(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]])
    def tr(x, y, z):
        m = np.eye(4); m[:3, 3] = [x, y, z]; return m
    return tr(0, s_c * math.sin(th), s_c * math.cos(th)) @ rx(-th) @ rx(math.radians(90)) @ tr(-W / 2, -H / 2, 0)


# ----------------------------------------------------------------------------- drawing helpers
class View:
    """model (u, v) -> paper (x, y) mm: x = ox + s*(u or -u), y = oy + s*v"""
    def __init__(self, ax, ox, oy, s=1.0, flip_u=False, swap=False):
        self.ax, self.ox, self.oy, self.s, self.f, self.swap = ax, ox, oy, s, -1 if flip_u else 1, swap

    def p(self, u, v):
        return (self.ox + self.f * self.s * u, self.oy + self.s * v)

    def geom(self, g, fill=None, lw=LW, ls="-", hatch=None, color=INK, z=2):
        polys = getattr(g, "geoms", [g])
        for poly in polys:
            if poly.is_empty or not isinstance(poly, Polygon):
                continue
            rings = [poly.exterior] + list(poly.interiors)
            verts, codes = [], []
            for r in rings:
                pts = [self.p(*(c[::-1] if self.swap else c)) for c in r.coords]
                verts += pts; codes += [Path.MOVETO] + [Path.LINETO] * (len(pts) - 2) + [Path.CLOSEPOLY]
            self.ax.add_patch(PathPatch(Path(verts, codes), facecolor=fill or "none", edgecolor=color, lw=lw,
                                        ls=ls, hatch=hatch, zorder=z))

    def line(self, a, b, lw=THIN, ls="-", color=INK, z=3):
        (x1, y1), (x2, y2) = self.p(*a), self.p(*b)
        self.ax.plot([x1, x2], [y1, y2], lw=lw, ls=ls, color=color, zorder=z)

    def centre(self, a, b):
        self.line(a, b, lw=HAIR, ls=(0, (8, 2, 1.5, 2)))

    def text(self, u, v, s, **kw):
        x, y = self.p(u, v)
        kw.setdefault("ha", "center"); kw.setdefault("va", "center"); kw.setdefault("zorder", 6)
        self.ax.text(x, y, s, **kw)


def arrow(ax, a, b):
    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="<|-|>,head_length=0.35,head_width=0.12", lw=THIN,
                                                    color=INK, shrinkA=0, shrinkB=0), zorder=5)


def hdim(ax, a, b, y, text, fs=6.5, above=True, ext=True):
    """horizontal dimension between paper points a and b, dimension line at paper height y"""
    s = 1 if y >= max(a[1], b[1]) else -1
    if ext:
        for p in (a, b):
            ax.plot([p[0], p[0]], [p[1] + s * 0.8, y + s * 1.2], lw=HAIR, color=INK, zorder=4)
    arrow(ax, (a[0], y), (b[0], y))
    w = abs(b[0] - a[0])
    xt = (a[0] + b[0]) / 2
    if w < 7:   # small: put the text beside
        xt = max(a[0], b[0]) + 1.2 + 0.9 * len(text)
    ax.text(xt, y + (0.9 if above else -0.9), text, ha="center", va="bottom" if above else "top", fontsize=fs, zorder=6,
            bbox=dict(fc="white", ec="none", pad=0.15))


def vdim(ax, a, b, x, text, fs=6.5, left=True, ext=True):
    s = 1 if x >= max(a[0], b[0]) else -1
    if ext:
        for p in (a, b):
            ax.plot([p[0] + s * 0.8, x + s * 1.2], [p[1], p[1]], lw=HAIR, color=INK, zorder=4)
    arrow(ax, (x, a[1]), (x, b[1]))
    h = abs(b[1] - a[1])
    yt = (a[1] + b[1]) / 2
    if h < 7:
        yt = max(a[1], b[1]) + 1.0 + 0.9 * len(text)
    ax.text(x + (-0.9 if left else 0.9), yt, text, ha="right" if left else "left", va="center", rotation=90 if h >= 7 else 0,
            fontsize=fs, zorder=6, bbox=dict(fc="white", ec="none", pad=0.15))
    if h >= 7:   # rotated text reads bottom-up; recentre
        ax.texts[-1].set_ha("center"); ax.texts[-1].set_x(x + (-1.6 if left else 1.6))


def leader(ax, p, t, text, fs=6.2, ha="left"):
    ax.annotate(text, xy=p, xytext=t, fontsize=fs, ha=ha, va="center", zorder=7,
                arrowprops=dict(arrowstyle="-|>,head_length=0.35,head_width=0.12", lw=THIN, color=INK, shrinkA=1, shrinkB=0),
                bbox=dict(fc="white", ec="none", pad=0.2))


def label(ax, x, y, title, sub=None):
    ax.text(x, y, title, fontsize=8.5, fontweight="bold", ha="center", va="bottom", zorder=6)
    if sub:
        ax.text(x, y - 0.6, sub, fontsize=6, ha="center", va="top", zorder=6, color="#333")


def sheet(title, number, total):
    fig = plt.figure(figsize=(420 / 25.4, 297 / 25.4))
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 420); ax.set_ylim(0, 297); ax.set_aspect("equal"); ax.axis("off")
    ax.add_patch(Rectangle((10, 10), 400, 277, fill=False, lw=0.9, color=INK))
    # title block
    x0, y0, w, h = 262, 10, 148, 38
    ax.add_patch(Rectangle((x0, y0), w, h, fill=False, lw=0.7, color=INK))
    for yy in (y0 + 26, y0 + 18, y0 + 10):
        ax.plot([x0, x0 + w], [yy, yy], lw=THIN, color=INK)
    ax.plot([x0 + 74, x0 + 74], [y0, y0 + 18], lw=THIN, color=INK)
    ax.plot([x0 + 111, x0 + 111], [y0, y0 + 18], lw=THIN, color=INK)
    ax.text(x0 + 2, y0 + 32.5, "A320-STYLE DUAL PFD / ND HOUSING", fontsize=10.5, fontweight="bold", va="center")
    ax.text(x0 + 2, y0 + 28.2, "for Samsung Galaxy Tab A11 8.7\" (211.0 x 124.7 x 8.0)", fontsize=7, va="center")
    ax.text(x0 + 2, y0 + 22, title, fontsize=8, fontweight="bold", va="center")
    ax.text(x0 + 2, y0 + 14, "UNITS  mm      PROJECTION  third angle", fontsize=6.2, va="center")
    ax.text(x0 + 2, y0 + 5, "SCALE  1:1 on A3 unless noted", fontsize=6.2, va="center")
    ax.text(x0 + 76, y0 + 14, f"MATERIAL  PLA / PLA+\nTPU (liner, optional)", fontsize=6, va="center")
    ax.text(x0 + 76, y0 + 5, f"COLOUR  {info['colour']}\nmatte blue-grey", fontsize=6, va="center")
    ax.text(x0 + 113, y0 + 14, f"SHEET {number}/{total}\nREV A", fontsize=6.2, va="center")
    ax.text(x0 + 113, y0 + 5, f"{date.today().isoformat()}\nOpenSCAD source", fontsize=6, va="center")
    ax.add_patch(Rectangle((x0 + 131, y0 + 2), 15, 6.5, fc=info["colour"], ec=INK, lw=THIN))
    return fig, ax


def notes(ax, x, y, lines, fs=6.3, title="NOTES"):
    ax.text(x, y, title, fontsize=7.2, fontweight="bold", va="top")
    for i, l in enumerate(lines):
        ax.text(x, y - 4.2 - i * 3.6, l, fontsize=fs, va="top")


# ============================================================================= SHEET 1
fig1, ax = sheet("SHEET 1 - FRONT BEZEL, SECTIONS & EDGE OPENINGS", 1, 2)


def title(ax, x, y, t, sub=None):
    ax.text(x, y, t, fontsize=8.5, fontweight="bold", ha="left", va="bottom", zorder=6)
    if sub:
        ax.text(x + len(t) * 2.15 + 3, y + 0.2, sub, fontsize=6, ha="left", va="bottom", color="#333", zorder=6)


# ---- front view 1:1 -------------------------------------------------------
F = View(ax, 36, 138)
outer2 = section(bezel, "z", 1.0)
glass = section(bezel, "z", 0.002)
pad = section(bezel, "z", bezel_t + 0.05)
topf = section(bezel, "z", bezel_top - 0.02)
crown = section(bezel, "z", bezel_top + crown_h * 0.5)
F.geom(outer2, fill="#eef0f3", lw=LW)
for g in getattr(glass, "geoms", [glass]):
    for r in g.interiors:
        F.geom(Polygon(r), fill="white", lw=LW)
for g in getattr(pad, "geoms", [pad]):
    F.geom(Polygon(g.exterior), lw=THIN)
for g in getattr(topf, "geoms", [topf]):
    for r in g.interiors:
        if Polygon(r).area > 500:
            F.geom(Polygon(r), lw=HAIR)
F.geom(crown, lw=THIN)
F.geom(section(tablet, "z", z_tab_b + 1), lw=THIN, ls=(0, (4, 2)))
F.geom(Polygon([(scr_x0, scr_y0), (scr_x0 + scr_w, scr_y0), (scr_x0 + scr_w, scr_y0 + scr_h), (scr_x0, scr_y0 + scr_h)]),
       lw=HAIR, ls=(0, (6, 1.5, 1, 1.5)), color="#555")
for sx, sy in info["screws"]:
    x, y = F.p(sx, sy)
    ax.add_patch(Circle((x, y), info["screw_spec"][4] / 2, fill=False, lw=THIN, zorder=4))
    ax.add_patch(Circle((x, y), 3.4 / 2, fill=False, lw=THIN, zorder=4))
F.centre((div_cx, -9), (div_cx, H + 9))
F.centre((-8, H / 2), (W + 8, H / 2))
title(ax, 36, 280, "FRONT VIEW (1:1)", "bezel as installed - PFD left, ND right")

hdim(ax, F.p(-o, -o), F.p(W + o, -o), F.p(0, -o - 7)[1], f"{out_w:.1f}", above=False)
vdim(ax, F.p(-o, -o), F.p(-o, H + o), F.p(-o - 9, 0)[0], f"{out_h:.1f}")
yc = F.p(0, H + o + 5)[1]
hdim(ax, F.p(pfd[0], pfd[3]), F.p(pfd[2], pfd[3]), yc, f"PFD {pfd[2]-pfd[0]:.1f}")
hdim(ax, F.p(pfd[2], pfd[3]), F.p(nd[0], nd[3]), yc, f"{div_w:.1f}")
hdim(ax, F.p(nd[0], nd[3]), F.p(nd[2], nd[3]), yc, f"ND {nd[2]-nd[0]:.1f}")
xb = F.p(W + o + 6, 0)[0]
vdim(ax, F.p(W, 0), F.p(nd[2], nd[1]), xb, f"{nd[1]:.1f}", left=False)
vdim(ax, F.p(nd[2], nd[1]), F.p(nd[2], nd[3]), xb, f"{nd[3]-nd[1]:.1f}", left=False)
vdim(ax, F.p(nd[2], nd[3]), F.p(W, H), xb, f"{H-nd[3]:.1f}", left=False)
vdim(ax, F.p(W, 0), F.p(W, H), xb + 9, f"{H:.1f}", left=False)
ax.text(xb + 4.5, F.p(0, -o - 2)[1], "from tablet\nedge", fontsize=5.3, ha="center", va="top")
xv = F.p(-o - 17, 0)[0]
vdim(ax, F.p(-o, H + o), F.p(pfd[0], pfd[3]), xv, f"{H + o - pfd[3]:.1f}")
vdim(ax, F.p(-o, -o), F.p(pfd[0], pfd[1]), xv, f"{pfd[1] + o:.1f}")
ax.text(xv, F.p(0, H / 2)[1], "visible\nband", fontsize=5.3, ha="center", va="center")
leader(ax, F.p(pfd[0], 32), F.p(16, 40), f"{pfd[0]:.1f} from tablet edge\n({pfd[0] + o:.1f} visible band), both sides")
leader(ax, F.p(info["front_cam"][0] + 1, info["front_cam"][1] + 2), F.p(16, 80), f"front camera notch R{info['front_cam'][2]:.1f}")
sx, sy = info["screws"][2]
leader(ax, F.p(sx + 2.2, sy - 2.2), F.p(12, H - 3), "4x M3 countersunk, clr 3.4 / csk 6.4 x 90")
leader(ax, F.p(div_cx + 0.5, H / 2 + 34), F.p(div_cx + 12, H / 2 + 34),
       f"central divider {div_w:.1f} at the glass\ncentre line {div_cx:.1f} = screen centre")
ax.text(*F.p(W - 4, 3), "TABLET 211.0 x 124.7 (dashed)", fontsize=5.3, ha="right", va="bottom", color="#333")
ax.text(*F.p(scr_x0 + 2, scr_y0 + 2.5), f"active area ~{scr_w:.1f} x {scr_h:.1f} (est., dash-dot)", fontsize=5.3,
        ha="left", va="bottom", color="#555")
for v_ in (-o - 3, H + o + 3):
    F.line((54.5, v_ - 2), (54.5, v_ + 2), lw=0.9)
    ax.text(F.p(54.5, 0)[0] + 2.2, F.p(0, v_)[1], "A", fontsize=8, fontweight="bold", va="center")
F.line((div_cx - 12, H / 2 + 20), (div_cx - 6, H / 2 + 20), lw=0.9)
F.line((div_cx + 6, H / 2 + 20), (div_cx + 12, H / 2 + 20), lw=0.9)
for d in (-14, 14):
    ax.text(*F.p(div_cx + d, H / 2 + 20), "B", fontsize=8, fontweight="bold", ha="center", va="center")

# ---- section A-A (x = 54.5) 1:1, right-side view (front on the left) ------
A = View(ax, 298, 138, 1.0, flip_u=True, swap=True)
for m, fill in ((shell, CUT), (bezel_c, CUT), (tpu, "#555"), (tablet, "#9aa0a6")):
    A.geom(section(m, "x", 54.5), fill=fill, lw=THIN if m is tablet else LW, hatch="////" if fill == CUT else None)
title(ax, 276, 280, "SECTION A-A (1:1)")
hdim(ax, A.p(shell_h + bezel_top, H + o), A.p(0, H + o), A.p(0, H + o + 5)[1], f"{shell_h + bezel_top:.1f}")
vdim(ax, A.p(0, -o), A.p(0, H + o), A.p(-6, 0)[0], f"{out_h:.1f}", left=False)
ax.text(*A.p(total_d / 2, -o - 3), "FRONT  REAR", fontsize=5.3, ha="center", va="top")

# ---- detail C: top border of A-A, 2.5:1 -----------------------------------
sc = 2.5
C = View(ax, 396, 200 - sc * (H - 22), sc, flip_u=True, swap=True)
clipC = Polygon([(H - 22, -1), (H + o + 0.5, -1), (H + o + 0.5, total_d + 1), (H - 22, total_d + 1)])
for m, fill in ((shell, CUT), (bezel_c, CUT), (tpu, "#555"), (tablet, "#9aa0a6")):
    C.geom(section(m, "x", 54.5).intersection(clipC), fill=fill, lw=THIN if m is tablet else LW,
           hatch="////" if fill == CUT else None)
ax.text(*C.p(total_d / 2, H - 22 - 6.5), "DETAIL C (2.5:1) - upper border of A-A", fontsize=7.5, fontweight="bold",
        ha="center", va="top")
yC = C.p(0, H + o + 2.5)[1]
hdim(ax, C.p(z_floor, H + o), C.p(0, H + o), yC, f"{z_floor:.1f}")
hdim(ax, C.p(z_tab_f, H + o), C.p(z_tab_b, H + o), yC, f"{T:.1f}")
hdim(ax, C.p(z_rim + bezel_t, H + o), C.p(z_rim, H + o), yC, f"{bezel_t:.1f}")
hdim(ax, C.p(shell_h, H + o), C.p(0, H + o), yC + 6, f"{shell_h:.1f} housing")
xC = C.p(total_d + 1.5, 0)[0]
vdim(ax, C.p(z_rim + bezel_t, H), C.p(z_rim + bezel_t, pfd[3]), xC, f"{H - pfd[3]:.1f}")
vdim(ax, C.p(z_rim + bezel_t, H + o), C.p(z_rim + bezel_t, H), xC, f"{o:.1f}")
leader(ax, C.p(z_floor + 1.1, H - 8), (352, 194), f"PLA rib {info['ribs'][2]:.1f} + TPU 0.8 - 0.4 to tablet")
leader(ax, C.p(z_rim + bezel_t + 0.4, pfd[3] + 1.5), (311, 232), f"raised surround +{bezel_top - bezel_t:.1f}")
leader(ax, C.p(z_tab_f - 2, H - 16), (311, 207), "tablet glass\n(15.0 covered)")

# ---- section B-B: divider (y = H/2) 5:1 ------------------------------------
B = View(ax, 324 - 5 * (div_cx - 7.5), 132 - 5 * (z_rim - 2.0), 5.0)
clipB = Polygon([(div_cx - 7.5, z_rim - 2), (div_cx + 7.5, z_rim - 2), (div_cx + 7.5, z_rim + 5), (div_cx - 7.5, z_rim + 5)])
B.geom(section(bezel_c, "y", H / 2).intersection(clipB), fill=CUT, hatch="////")
B.geom(section(tablet, "y", H / 2).intersection(clipB), fill="#9aa0a6", lw=THIN)
ax.text(*B.p(div_cx, z_rim - 4.0), "SECTION B-B (5:1) - central divider", fontsize=7.5, fontweight="bold",
        ha="center", va="top")
hdim(ax, B.p(div_cx - div_w / 2, z_rim), B.p(div_cx + div_w / 2, z_rim), B.p(0, z_rim - 2.6)[1], f"{div_w:.1f} at glass",
     above=False)
hdim(ax, B.p(div_cx - div_w_top / 2, z_rim + div_h), B.p(div_cx + div_w_top / 2, z_rim + div_h),
     B.p(0, z_rim + div_h + 0.9)[1], f"{div_w_top:.1f}")
vdim(ax, B.p(div_cx + 1.1, z_rim), B.p(div_cx + 1.1, z_rim + div_h), B.p(div_cx + 5.5, 0)[0], f"{div_h:.1f}", left=False)
B.centre((div_cx, z_rim - 1.8), (div_cx, z_rim + 4.8))
ax.text(*B.p(div_cx - 5.2, z_rim - 1.0), "tablet glass", fontsize=5.5, ha="center", va="center")
ax.text(*B.p(div_cx - 4.5, z_rim + 2.3), "PFD", fontsize=6, ha="center", fontweight="bold")
ax.text(*B.p(div_cx + 3.0, z_rim + 2.3), "ND", fontsize=6, ha="center", fontweight="bold")

# ---- edge openings: sections through the walls (1:1) ------------------------
mid = clr_xy + wall / 2
ports = info["ports"]
E = View(ax, 36, 94)
E.geom(section(shell, "y", H + mid), fill=CUT, hatch="////")
E.geom(section(bezel_c, "y", H + mid), fill=CUT, hatch="////")
E.line((0, -2), (0, total_d + 1), lw=HAIR, ls=(0, (4, 2)))
title(ax, 36, 115, "VIEW D - TOP EDGE (1:1)", "section through the wall, front up")
for p in ports:
    name, edge, pos, w, h, zoff, relief = p
    if edge != "top":
        continue
    zb = (z_tab_b + z_tab_f) / 2 + zoff - h / 2
    hdim(ax, E.p(0, 0), E.p(pos, zb), E.p(0, -5)[1], f"{pos:.1f}", above=False)
    hdim(ax, E.p(pos - w / 2, zb), E.p(pos + w / 2, zb), E.p(0, -10.5)[1], f"{w:.0f}", above=False)
    ax.text(*E.p(pos, total_d + 1.0), name + " - finger relief (wall 1.2)", fontsize=5.4, ha="center", va="bottom")


def wall_view(edge, ox, oy, t):
    plane = -mid if edge == "left" else W + mid
    V = View(ax, ox, oy)
    V.geom(section(shell, "x", plane), fill=CUT, hatch="////")
    V.geom(section(bezel_c, "x", plane), fill=CUT, hatch="////")
    V.line((0, -2), (0, total_d + 1), lw=HAIR, ls=(0, (4, 2)))
    V.line((H, -2), (H, total_d + 1), lw=HAIR, ls=(0, (4, 2)))
    title(ax, ox, oy + total_d + 3.5, t)
    k = 0
    for p in ports:
        name, e, pos, w, h, zoff, relief = p
        if e != edge:
            continue
        zb = (z_tab_b + z_tab_f) / 2 + zoff - h / 2
        hdim(ax, V.p(0, 0), V.p(pos, zb), V.p(0, -5 - 5.5 * k)[1], f"{pos:.1f}", above=False)
        ax.text(*V.p(pos, total_d + 1.0), f"{name} ({w:.0f})", fontsize=5.0, ha="center", va="bottom")
        k += 1
    vdim(ax, V.p(H + o, 0), V.p(H + o, shell_h), V.p(H + o + 4, 0)[0], f"{shell_h:.1f}", left=False)


wall_view("left", 24, 50, "VIEW E - LEFT EDGE (bottom -> top, 1:1)")
wall_view("right", 166, 50, "VIEW F - RIGHT EDGE (bottom -> top, 1:1)")

notes(ax, 300, 113, [
    "1. Borders are measured on the glass plane from the TABLET",
    "   EDGE (border_datum = \"tablet\"): 15 / 15 / 5 / 5 mm. The visible",
    "   frame band adds clearance + wall 4.1 mm (19.1 / 9.1 mm).",
    "2. Windows are exact at the glass and open towards the front",
    "   (1.0 mm outer edges, 0.4 mm divider flanks).",
    "3. Print at 100 % on A3: the front view is true size.",
    "4. Tablet corner R8 and all edge openings are estimates -",
    "   print fit_test_ring and adjust `ports` before the housing.",
    "5. Edge notches are open towards the bezel: no bridges.",
], fs=5.9)
fig1.savefig(ROOT / "docs" / "technical_drawing_sheet1.png", dpi=150)

# ============================================================================= SHEET 2
fig2, ax = sheet("SHEET 2 - REAR HOUSING, MOUNTING & DATA", 2, 2)

Rv = View(ax, 36 + out_w - o, 126, 1.0, flip_u=True)
Rv.geom(section(shell, "z", 1.0), fill="#eef0f3")
Rv.geom(section(shell, "z", z_floor + 1.0), lw=HAIR, ls=(0, (4, 2)))
for vx, vy in info["vesa"][1]:
    x, y = Rv.p(vx, vy)
    ax.add_patch(Circle((x, y), 6, fill=False, lw=HAIR, ls=(0, (3, 1.5)), zorder=4))
Rv.centre((W / 2, -9), (W / 2, H + 9)); Rv.centre((-9, H / 2), (W + 9, H / 2))
title(ax, 36, 270, "REAR VIEW (1:1)", "seen from behind - X mirrored; dashed = inside (ribs, ring, nut bosses)")
(v1x, v1y), (v2x, v2y) = info["vesa"][1][0], info["vesa"][1][3]
hdim(ax, Rv.p(v2x, v2y), Rv.p(v1x, v2y), Rv.p(0, H + o + 5)[1], f"VESA {info['vesa'][0]:.0f}")
vdim(ax, Rv.p(v1x, v1y), Rv.p(v1x, v2y), Rv.p(W + o + 7, 0)[0], f"{info['vesa'][0]:.0f}")
hdim(ax, Rv.p(W + o, -o), Rv.p(-o, -o), Rv.p(0, -o - 6)[1], f"{out_w:.1f}", above=False)
vdim(ax, Rv.p(-o, -o), Rv.p(-o, H + o), Rv.p(-o - 7, 0)[0], f"{out_h:.1f}", left=False)
rc = info["rear_cam"]
leader(ax, Rv.p(rc[0] - 4.5, rc[1] + 4.5), (266, 262), f"rear camera dia {rc[2]:.0f}\n{rc[0]:.0f} / {H - rc[1]:.0f} from corner")
s0 = info["springs"][0][1]
leader(ax, Rv.p(s0[0], s0[1] + 16), (26, 104),
       f"4x PLA leaf spring {info['springs'][1]:.0f} x {info['springs'][2]:.0f} x {info['springs'][3]:.1f}, "
       f"preload {info['springs'][4]:.1f} mm (~{info['springs'][4]*info['springs'][5]:.1f} N)")
leader(ax, Rv.p(info["vesa"][1][2][0], info["vesa"][1][2][1]), (96, 99), "4x M4 hex-nut trap inside, dia 4.5 through")
leader(ax, Rv.p(W / 2 - 12.5 - 6, 21), (172, 104),
       f"{info['vents'][0]} vent slots {info['vents'][1]:.0f} x {info['vents'][2]:.0f} (low intake / high exhaust)")

# ---- stand side view 1:2 ----------------------------------------------------
Mx = assembly_matrix()
S = View(ax, 302, 148, 0.5)
gx = 46.0
S.geom(section(stand, "x", gx), fill=CUT, hatch="////")
for m in (shell, bezel_c):
    mm = m.copy(); mm.apply_transform(Mx)
    S.geom(section(mm, "x", gx), fill="#c7ccd3", lw=THIN)
tb = tablet.copy(); tb.apply_transform(Mx)
S.geom(section(tb, "x", gx), fill="#9aa0a6", lw=HAIR)
S.line((-45, 0), (140, 0), lw=THIN)
ax.text(*S.p(-44, -3), "DESK", fontsize=5.3, ha="left", va="top")
title(ax, 276, 236, "SIDE VIEW ON STAND (1:2)")
ax.text(276, 232.5, "section through a gusset, viewer on the left", fontsize=6, color="#333", va="bottom")
th = info["stand"][0]
cx_, cy_ = S.p(0, 0)
ax.plot([cx_, cx_], [cy_, cy_ + 72], lw=HAIR, ls=(0, (4, 2)), color=INK)
ax.add_patch(Arc((cx_, cy_), 130, 130, theta1=90 - th, theta2=90, lw=THIN, color=INK))
ax.text(cx_ - 2, cy_ + 66, f"{th:.1f}° recline\nfrom vertical", fontsize=6.3, ha="right", va="center")
bb = stand.bounds
hdim(ax, S.p(bb[0][1], 0), S.p(bb[1][1], 0), S.p(0, -10)[1], f"{bb[1][1] - bb[0][1]:.0f} base depth", above=False)
case_bb = trimesh.util.concatenate([shell.copy().apply_transform(Mx), bezel_c.copy().apply_transform(Mx)]).bounds
vdim(ax, S.p(bb[1][1], 0), S.p(bb[1][1], case_bb[1][2]), S.p(bb[1][1] + 12, 0)[0], f"{case_bb[1][2]:.0f}", left=False)
leader(ax, S.p(-14, case_bb[0][2] + 1), S.p(-60, 34), f"{case_bb[0][2]:.1f} to desk")

# ---- reference render -------------------------------------------------------
img_path = ROOT / "renders" / "preview_front_3q.png"
if img_path.exists():
    img = plt.imread(img_path)[200:800, 380:1220]
    h_, w_ = img.shape[:2]
    x0, y0, wd = 300, 56, 106
    ax.imshow(img, extent=(x0, x0 + wd, y0, y0 + wd * h_ / w_), zorder=1)
    ax.text(x0, y0 + wd * h_ / w_ + 1.5, "REFERENCE RENDER (not to scale)", fontsize=6.5, fontweight="bold", va="bottom")


def table(ax, x, y, cols, rows, widths, ttl, fs=6.0, rh=4.4):
    ax.text(x, y + 2, ttl, fontsize=7.2, fontweight="bold", va="bottom")
    yy = y
    for r_i, row in enumerate([cols] + rows):
        xx = x
        for c, w in zip(row, widths):
            ax.add_patch(Rectangle((xx, yy - rh), w, rh, fill=r_i == 0, fc="#e6e9ed", ec=INK, lw=HAIR))
            ax.text(xx + 1.2, yy - rh / 2, c, fontsize=fs, va="center", fontweight="bold" if r_i == 0 else None)
            xx += w
        yy -= rh
    return yy


yy = table(ax, 14, 88, ["#", "Part (STL)", "Material", "Qty", "Print orientation / notes"], [
    ["1", "front_bezel_PLA", "PLA/PLA+", "1", "face UP, flat back on bed, 0.2 mm layers, 4 walls"],
    ["2", "rear_housing_PLA", "PLA/PLA+", "1", "back DOWN, open side up, 4 walls, 20-25 % infill"],
    ["3", "desk_stand_PLA", "PLA/PETG", "1", "base DOWN, 4 walls, 25 % infill"],
    ["4", "tpu_liner_TPU_optional", "TPU 95A", "1", "flat, 0.8 mm (protective back pads)"],
    ["5", "fit_test_ring_PLA_optional", "PLA", "1", "quick check of outline, screws and ports"],
    ["H1", "M3 x 12 countersunk (ISO 10642)", "steel", "4", "bezel -> housing, self-tapping into 2.6 pilot"],
    ["H2", "M4 hex nut (ISO 4032)", "steel", "4", "pressed into the nut traps (VESA 75)"],
    ["H3", "M4 x 10 socket / button head", "steel", "4", "stand -> housing (other bracket: t + 5 mm)"],
], [7, 49, 17, 8, 84], "PARTS & HARDWARE")
pp, npx = info["pfd_px"], info["nd_px"]
table(ax, 14, yy - 7, ["Window", "x range (px)", "y range (px, from top)", "size (px)", "size (mm, at glass)"], [
    ["PFD", f"{pp[0]:.0f} - {pp[2]:.0f}", f"{pp[1]:.0f} - {pp[3]:.0f}", f"{pp[2]-pp[0]:.0f} x {pp[3]-pp[1]:.0f}",
     f"{pfd[2]-pfd[0]:.1f} x {pfd[3]-pfd[1]:.1f}"],
    ["ND", f"{npx[0]:.0f} - {npx[2]:.0f}", f"{npx[1]:.0f} - {npx[3]:.0f}", f"{npx[2]-npx[0]:.0f} x {npx[3]-npx[1]:.0f}",
     f"{nd[2]-nd[0]:.1f} x {nd[3]-nd[1]:.1f}"],
    ["hidden", f"divider {pp[2]:.0f} - {npx[0]:.0f}", f"top 0 - {pp[1]:.0f}, bottom {pp[3]:.0f} - 800", "-",
     f"pitch {px_mm:.4f} mm/px"],
], [16, 30, 44, 26, 49], "SCREEN MAP 1340 x 800 px (active area estimated)")

notes(ax, 186, 88, [
    "1. Nuts into the traps -> (TPU liner) -> tablet face up",
    "   -> bezel -> 4x M3 countersunk screws.",
    "2. Tighten until the bezel just seats (PLA threads).",
    "3. Springs push the tablet onto the bezel (0.5 mm).",
    "4. VESA 75 (M4): any monitor arm or cockpit bracket;",
    "   desk stand recline 17.5 deg (stand_tilt 15-20).",
    "5. Confirm edge openings with fit_test_ring first.",
    f"6. Overall {out_w:.1f} x {out_h:.1f} x {total_d:.1f} mm;",
    "   bed >= 222 x 135 mm.",
], fs=5.9, title="ASSEMBLY / USE")

fig2.savefig(ROOT / "docs" / "technical_drawing_sheet2.png", dpi=150)
with PdfPages(ROOT / "docs" / "technical_drawing.pdf") as pdf:
    pdf.savefig(fig1); pdf.savefig(fig2)
print("wrote docs/technical_drawing.pdf and sheet PNGs")
