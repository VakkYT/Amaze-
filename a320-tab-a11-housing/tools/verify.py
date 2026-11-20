#!/usr/bin/env python3
"""Geometric verification of the exported STLs (run tools/build.py first).

Checks: mesh integrity (manifold / watertight / single body), tablet fit,
bezel border dimensions, PFD/ND symmetry, divider position, port / camera
access, part collisions in the assembly, overhangs in print orientation and
bed footprint. Writes docs/verification_report.md and exits 1 on any FAIL.

Requires: numpy, trimesh, manifold3d, shapely
"""
import json
import math
import pathlib
import sys
from datetime import date

import manifold3d as mf
import numpy as np
import trimesh
from shapely.affinity import scale as sh_scale
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parent.parent
info = json.loads((ROOT / "build" / "info.json").read_text())
W, H, T, R = info["tablet"]
clr_xy, clr_z = info["clearance"]
wall, o = info["wall"]
z_floor, z_tab_b, z_tab_f, z_rim, bezel_t, bezel_top, crown_h, shell_h = info["z"]
cov_t, cov_b, cov_l, cov_r = info["borders_cov"]
pfd, nd = info["pfd"], info["nd"]
div_cx, div_w, div_w_top, div_h = info["divider"]

STL = {
    "front_bezel": "stl/front_bezel_PLA.stl",
    "rear_housing": "stl/rear_housing_PLA.stl",
    "desk_stand": "stl/desk_stand_PLA.stl",
    "tpu_liner": "stl/tpu_liner_TPU_optional.stl",
    "fit_test_ring": "stl/fit_test_ring_PLA_optional.stl",
}
TOL = 0.02     # mm, for straight-edge dimensions
rows = []


def record(group, name, ok, detail):
    status = {True: "PASS", False: "FAIL", None: "INFO"}[ok]
    rows.append((group, name, status, detail))
    print(f"[{status}] {group}: {name} - {detail}")


def load(rel):
    return trimesh.load(ROOT / rel, force="mesh")


def to_mf(m):
    return mf.Manifold(mf.Mesh(vert_properties=np.asarray(m.vertices, np.float32),
                               tri_verts=np.asarray(m.faces, np.uint32)))


def mf_to_tm(M):
    mesh = M.to_mesh()
    return trimesh.Trimesh(np.asarray(mesh.vert_properties)[:, :3], np.asarray(mesh.tri_verts), process=False)


def mf_box(x0, y0, z0, x1, y1, z1):
    return mf.Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])


def mf_cyl(x, y, z0, z1, r):
    return mf.Manifold.cylinder(z1 - z0, r, r, 64).translate([x, y, z0])


def section(mesh, axis, value):
    """Planar section -> shapely geometry in the plane's own 2D coordinates.
    axis z: (x, y);  axis x: (y, z);  axis y: (x, z)."""
    normal = {"x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]}[axis]
    origin = [value if a == axis else 0 for a in "xyz"]
    sec = mesh.section(plane_origin=origin, plane_normal=normal)
    if sec is None:
        return None
    M = np.eye(4)
    if axis == "z":
        M[2, 3] = -value
    elif axis == "x":
        M = np.array([[0, 1, 0, 0], [0, 0, 1, 0], [1, 0, 0, -value], [0, 0, 0, 1]], float)
    else:
        M = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, value], [0, 0, 0, 1]], float)
    p2, _ = sec.to_2D(to_2D=M)
    return unary_union(p2.polygons_full)


def assembly_matrix():
    """Case frame -> stand/desk frame (mirrors on_stand() in the .scad)."""
    th = math.radians(info["stand"][0])
    s_c = info["stand"][2]

    def rx(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]])

    def tr(x, y, z):
        m = np.eye(4); m[:3, 3] = [x, y, z]; return m
    return tr(0, s_c * math.sin(th), s_c * math.cos(th)) @ rx(-th) @ rx(math.radians(90)) @ tr(-W / 2, -H / 2, 0)


meshes = {k: load(v) for k, v in STL.items()}
tablet = load("build/tablet_dummy.stl")

# -----------------------------------------------------------------------------
# 1. mesh integrity
# -----------------------------------------------------------------------------
for name, m in meshes.items():
    M = to_mf(m)
    bodies = len(m.split(only_watertight=False))
    ok = m.is_watertight and m.is_winding_consistent and bodies == 1 and m.volume > 0 \
        and M.status() == mf.Error.NoError
    record("Manifold", name, ok,
           f"watertight={m.is_watertight}, winding={m.is_winding_consistent}, bodies={bodies}, "
           f"manifold3d={M.status().name}, genus={M.genus()}, volume={m.volume/1000:.1f} cm3, triangles={len(m.faces)}")

shell, bezel_local, stand, tpu = (meshes[k] for k in ("rear_housing", "front_bezel", "desk_stand", "tpu_liner"))
bezel = bezel_local.copy(); bezel.apply_translation([0, 0, z_rim])
tpu_pl = tpu.copy(); tpu_pl.apply_translation([0, 0, info["ribs"][2] + z_floor])
SH, BZ, TB, TP = to_mf(shell), to_mf(bezel), to_mf(tablet), to_mf(tpu_pl)

# -----------------------------------------------------------------------------
# 2. tablet fit
# -----------------------------------------------------------------------------
inter = SH ^ TB
parts = inter.decompose() if not inter.is_empty() else []
springs = info["springs"][0]
bump_top = info["springs"][6]
unexpected = 0.0
for p in parts:
    (x0, y0, z0), (x1, y1, z1) = np.asarray(p.bounding_box()[:3]), np.asarray(p.bounding_box()[3:])
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    near_spring = any(abs(cx - s[0]) < 6 and abs(cy - (s[1] + s[2] * 4)) < 6 for s in springs)
    if not (near_spring and z0 >= z_tab_b - 1e-3 and z1 <= bump_top + 1e-3):
        unexpected += p.volume()
record("Tablet fit", "tablet vs rear housing", unexpected < 1e-3,
       f"only overlap = {len(parts)} spring pads x {bump_top - z_tab_b:.2f} mm preload "
       f"({inter.volume():.1f} mm3 total, intended); unexpected overlap {unexpected:.4f} mm3")
iv = (BZ ^ TB).volume()
record("Tablet fit", "tablet vs front bezel", iv < 1e-3, f"overlap {iv:.4f} mm3 (bezel rests on the glass)")
iv = (TP ^ TB).volume()
gap_tpu = z_tab_b - (z_floor + info["ribs"][2] + 0.8)
record("Tablet fit", "tablet vs TPU liner", iv < 1e-3,
       f"overlap {iv:.4f} mm3; liner top {gap_tpu:.2f} mm behind the clamped tablet (soft back-stop)")

z_mid = (z_tab_b + z_tab_f) / 2
cav = section(shell, "z", z_mid)          # wall material at tablet mid-thickness
tab2d = section(tablet, "z", z_mid)
gap_min = tab2d.distance(cav)
gap_wall = tab2d.distance(cav.intersection(box(W / 2 + 30, -6, W / 2 + 50, 1)))
record("Tablet fit", "plan-view clearance at mid-thickness", not tab2d.intersects(cav) and gap_min > 0.1,
       f"no contact; nominal wall gap {gap_wall:.2f} mm, minimum gap {gap_min:.2f} mm (at the centring ribs)")
record("Tablet fit", "depth stack", None,
       f"floor {z_floor:.1f} | rib {info['ribs'][2]:.1f} | TPU 0.8 | gap {gap_tpu:.1f} | tablet {T:.1f} | "
       f"bezel seat at z={z_rim:.1f} mm; springs preload {info['springs'][4]:.1f} mm "
       f"({info['springs'][5]*info['springs'][4]:.1f} N each, k={info['springs'][5]:.2f} N/mm)")

# -----------------------------------------------------------------------------
# 3. bezel borders, symmetry, divider
# -----------------------------------------------------------------------------
glass = section(bezel_local, "z", 0.002)            # at the glass (bezel underside)
outer = section(bezel_local, "z", 1.0)              # full outer outline (between chamfers)
win = [Polygon(r)
       for g in getattr(glass, "geoms", [glass]) for r in g.interiors]
win = sorted([w for w in win if w.area > 1000], key=lambda p: p.bounds[0])
fc = info["front_cam"]
cam_disc = Point(fc[0], fc[1]).buffer(fc[2] + 2.0)
P, N = win[0], win[1]
Pw, Nw = P.difference(cam_disc), N.difference(Point(2 * div_cx - fc[0], fc[1]).buffer(fc[2] + 2.0))
Pb, Nb = Pw.bounds, Nw.bounds
ob = outer.bounds
meas = {"top": H - Pb[3], "bottom": Pb[1], "left": Pb[0], "right": W - Nb[2]}
spec = {"top": cov_t, "bottom": cov_b, "left": cov_l, "right": cov_r}
for k in ("top", "bottom", "left", "right"):
    record("Bezel borders", f"{k} border (from tablet edge)", abs(meas[k] - spec[k]) < TOL,
           f"measured {meas[k]:.3f} mm, spec {spec[k]:.1f} mm")
record("Bezel borders", "ND top/bottom border", abs(H - Nb[3] - cov_t) < TOL and abs(Nb[1] - cov_b) < TOL,
       f"top {H - Nb[3]:.3f} mm, bottom {Nb[1]:.3f} mm")
vis = {"top": ob[3] - Pb[3], "bottom": Pb[1] - ob[1], "left": Pb[0] - ob[0], "right": ob[2] - Nb[2]}
record("Bezel borders", "visible frame band (outer edge -> window)", None,
       ", ".join(f"{k} {v:.2f}" for k, v in vis.items()) + f" mm (= border + {o:.1f} mm clearance & wall)")
record("Bezel borders", "overall outline", None, f"{ob[2]-ob[0]:.2f} x {ob[3]-ob[1]:.2f} mm")

pw, ph = Pb[2] - Pb[0], Pb[3] - Pb[1]
nw, nh = Nb[2] - Nb[0], Nb[3] - Nb[1]
mirror_nd = sh_scale(Nw, xfact=-1, yfact=1, origin=(div_cx, 0))
sym_err = Pw.symmetric_difference(mirror_nd).area
record("Symmetry", "PFD vs ND window size", abs(pw - nw) < TOL and abs(ph - nh) < TOL,
       f"PFD {pw:.3f} x {ph:.3f} mm, ND {nw:.3f} x {nh:.3f} mm")
record("Symmetry", "ND = mirror image of PFD about the divider", sym_err < 0.5,
       f"symmetric-difference area {sym_err:.3f} mm2 (camera notch excluded)")
gap = Nb[0] - Pb[2]
centre = (Nb[0] + Pb[2]) / 2
record("Divider", "width at the glass", abs(gap - div_w) < TOL, f"{gap:.3f} mm (spec {div_w:.1f})")
record("Divider", "centred on the screen", abs(centre - W / 2) < TOL, f"centre x = {centre:.3f} mm, tablet centre {W/2:.3f} mm")
top_sec = section(bezel_local, "z", bezel_top - 0.01)
seg = top_sec.intersection(box(div_cx - 3, H / 2 - 1, div_cx + 3, H / 2 + 1))
xs = seg.bounds
record("Divider", "profile", abs((xs[2] - xs[0]) - div_w_top) < 0.05,
       f"{div_w:.1f} mm at the glass -> {xs[2]-xs[0]:.2f} mm at the front, total height {bezel_local.bounds[1][2]:.2f} mm "
       f"({div_h - bezel_top:.1f} mm crown above the {bezel_top - bezel_t:.1f} mm display surround)")
xsec = section(bezel_local, "x", div_cx)
span = xsec.intersection(box(H / 2 - 60, -1, H / 2 + 60, 10)).bounds if xsec else None
record("Divider", "spans top border to bottom border", span is not None and span[0] < Pb[1] and span[2] > Pb[3],
       f"continuous from y={span[0]:.1f} to y={span[2]:.1f} mm")

# screen pixel map
record("Screen map", "visible pixels (estimated active area)", None,
       f"PFD x {info['pfd_px'][0]:.0f}-{info['pfd_px'][2]:.0f}, ND x {info['nd_px'][0]:.0f}-{info['nd_px'][2]:.0f}, "
       f"rows {info['pfd_px'][1]:.0f}-{info['pfd_px'][3]:.0f} of {800}; "
       f"{info['pfd_px'][1]:.0f} px hidden at the top and {800 - info['pfd_px'][3]:.0f} px at the bottom")

# -----------------------------------------------------------------------------
# 4. ports, buttons, cameras
# -----------------------------------------------------------------------------
probe_sizes = {  # name prefix -> (width along edge, height) of what must pass
    "USB-C": (12.4, 6.6), "3.5mm": (7.0, 7.0), "Speaker": (18.0, 2.0), "Power": (45.0, 3.0)}
for p in info["ports"]:
    name, edge, pos, w, h, zoff, relief = p
    pw_, ph_ = next(v for k, v in probe_sizes.items() if name.startswith(k))
    zc = z_mid + zoff
    n0, n1 = 0.05, o + 6
    if edge in ("left", "right"):
        xa, xb = (-n1, -n0) if edge == "left" else (W + n0, W + n1)
        pr = mf_box(xa, pos - pw_ / 2, zc - ph_ / 2, xb, pos + pw_ / 2, zc + ph_ / 2)
    else:
        ya, yb = (-n1, -n0) if edge == "bottom" else (H + n0, H + n1)
        pr = mf_box(pos - pw_ / 2, ya, zc - ph_ / 2, pos + pw_ / 2, yb, zc + ph_ / 2)
    hit = (pr ^ SH).volume() + (pr ^ BZ).volume()
    extra = f", wall thinned to {1.2:.1f} mm around the keys" if relief else ""
    record("Ports", f"{name} ({edge} edge @ {pos:.1f} mm)", hit < 1e-3,
           f"clear {pw_:.1f} x {ph_:.1f} mm path from tablet edge to outside (notch {w} mm wide){extra}")
rc = info["rear_cam"]
hit = (mf_cyl(rc[0], rc[1], -5, z_tab_b - 0.01, 4.0) ^ SH).volume()
record("Ports", "rear camera", hit < 1e-3, f"clear dia 8 mm view through the rear plate at ({rc[0]:.0f}, {rc[1]:.1f}); hole dia {rc[2]} mm")
hit = (mf_cyl(fc[0], fc[1], z_rim, z_rim + 10, 1.5) ^ BZ).volume()
record("Ports", "front camera", hit < 1e-3 or not fc[3], f"clear dia 3 mm lens path at ({fc[0]}, {fc[1]:.1f})")
for (vx, vy) in info["vesa"][1]:
    hit = (mf_cyl(vx, vy, -2, z_floor + 1, 2.0) ^ SH).volume()
    record("Mounting", f"VESA hole ({vx:.1f}, {vy:.2f})", hit < 1e-3, "M4 clearance open through the rear plate")
vn = info["vesa_nut"]
record("Mounting", "VESA screw cannot touch the tablet", vn[3] < z_tab_b - 0.5,
       f"M4x10 tip at z={vn[3]:.1f} mm, tablet back at z={z_tab_b:.1f} mm; {vn[0]:.1f} mm plate under each nut")

# -----------------------------------------------------------------------------
# 5. assembly collisions
# -----------------------------------------------------------------------------
v = (SH ^ BZ).volume()
record("Assembly", "rear housing vs bezel", v < 1e-3, f"overlap {v:.4f} mm3 (flat seat at z={z_rim})")
v = (SH ^ TP).volume()
record("Assembly", "rear housing vs TPU liner", v < 1e-3, f"overlap {v:.4f} mm3")
A = assembly_matrix()
case_desk = to_mf(shell).transform(A[:3, :].tolist())
inter = case_desk ^ to_mf(stand)
Ai = np.linalg.inv(A)
depth = 0.0
for p in (inter.decompose() if not inter.is_empty() else []):
    pts = np.asarray(p.to_mesh().vert_properties)[:, :3]
    zc = (Ai[:3, :3] @ pts.T).T[:, 2] + Ai[2, 3]        # back to case Z (0 = rear face)
    depth = max(depth, zc.max() - zc.min())
record("Assembly", "rear housing vs desk stand", depth < 0.01,
       f"flat face contact only: max penetration {depth:.4f} mm (float32 noise), {inter.volume():.3f} mm3")
asm = load("stl/assembly_combined_view_only.stl")
case_bb = trimesh.util.concatenate([shell.copy().apply_transform(A), bezel.copy().apply_transform(A), stand]).bounds
record("Assembly", "combined STL matches transformed parts", np.allclose(asm.bounds, case_bb, atol=0.05),
       f"assembly bbox {np.round(asm.bounds, 1).tolist()}")
tilt = info["stand"][0]
low = case_desk.bounding_box()[2]
record("Assembly", "stand inclination / clearance", 15 <= tilt <= 20 and low > 0,
       f"display leans back {tilt:.1f} deg from vertical; lowest point of the case {low:.1f} mm above the desk")

# screws
em, wm, _ = info["screw_margins"]
spec_ = info["screw_spec"]
record("Fasteners", "corner screw geometry", em > 0.8 and wm > 0.8,
       f"M{spec_[0]}x{spec_[1]} countersunk, {spec_[2]} mode, pilot {spec_[3]} mm; countersink {em:.2f} mm from the outer edge, "
       f"{wm:.2f} mm wall between pilot hole and cavity (with tab_r={R})")
for (sx, sy) in info["screws"]:
    hole = mf_cyl(sx, sy, z_rim - (spec_[1] - bezel_t) - 0.5, z_rim + bezel_t + 1, spec_[0] / 2 - 0.3)
    v = (hole ^ TB).volume()
    record("Fasteners", f"screw path at ({sx:.1f}, {sy:.1f})", v < 1e-3, "screw does not touch the tablet")

# -----------------------------------------------------------------------------
# 6. printability
# -----------------------------------------------------------------------------
BED_MIN = 0.25
for name, m in meshes.items():
    n, a, c = m.face_normals, m.area_faces, m.triangles_center
    zmin = m.bounds[0][2]
    over = (n[:, 2] < -math.cos(math.radians(45)) - 1e-3) & (c[:, 2] > zmin + BED_MIN)
    flat = (n[:, 2] < -0.999) & (c[:, 2] > zmin + BED_MIN)
    area = a[over].sum()
    detail = f"{area:.1f} mm2 steeper than 45 deg ({a[flat].sum():.1f} mm2 flat bridges)"
    if area > 0:
        sub = trimesh.Trimesh(m.vertices, m.faces[over], process=False)
        comps = sub.split(only_watertight=False)
        biggest = max((max(cc.extents[:2]) for cc in comps), default=0)
        detail += f" in {len(comps)} spots, largest span {biggest:.1f} mm"
        ok = biggest <= 10.0
    else:
        ok = True
    record("Printability", f"{name} overhangs (no supports needed)", ok, detail)
    ext = m.extents
    record("Printability", f"{name} footprint", None, f"{ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} mm")

# -----------------------------------------------------------------------------
# report
# -----------------------------------------------------------------------------
fails = [r for r in rows if r[2] == "FAIL"]
lines = ["# Verification report", "",
         f"Generated by `tools/verify.py` on {date.today().isoformat()} from the exported STLs and `build/info.json`.", "",
         f"**Result: {'ALL CHECKS PASSED' if not fails else str(len(fails)) + ' CHECK(S) FAILED'}** "
         f"({sum(r[2]=='PASS' for r in rows)} pass, {len(fails)} fail, {sum(r[2]=='INFO' for r in rows)} info)", "",
         "| Group | Check | Result | Detail |", "|---|---|---|---|"]
for g, n_, s, d in rows:
    lines.append(f"| {g} | {n_} | {'✅ PASS' if s=='PASS' else '❌ FAIL' if s=='FAIL' else 'ℹ️ info'} | {d} |")
lines += ["", "Notes:", "",
          "- The tablet dummy is a 211 x 124.7 x 8.0 mm body with plan-view corner radius `tab_r`; the active display area "
          "is estimated from the 8.7\" diagonal and 1340x800 resolution, centred on the body.",
          "- The only intended contact overlap is the spring preload at the four retention pads.",
          "- Overhang = downward-facing surface steeper than 45 deg from vertical, excluding the first 0.25 mm above the bed. "
          "Small round holes (M4 holes in the inclined stand plate) bridge without supports."]
(ROOT / "docs" / "verification_report.md").write_text("\n".join(lines) + "\n")
print(f"\n{len(fails)} failure(s); report written to docs/verification_report.md")
sys.exit(1 if fails else 0)
