#!/usr/bin/env python3
"""Export every part of the A320 dual-display housing to STL and dump the
model's derived dimensions to build/info.json.

    python3 tools/build.py                     # all parts
    python3 tools/build.py -D tab_r=10 -D wall=3.8   # with parameter overrides
    python3 tools/build.py --only front_bezel rear_housing

Needs OpenSCAD on PATH (or --openscad /path/to/openscad).
"""
import argparse
import concurrent.futures as cf
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAD = ROOT / "cad" / "a320_tab_a11_housing.scad"

# part name in the .scad -> output path (relative to the project root)
PARTS = {
    "front_bezel":   "stl/front_bezel_PLA.stl",
    "rear_housing":  "stl/rear_housing_PLA.stl",
    "desk_stand":    "stl/desk_stand_PLA.stl",
    "tpu_liner":     "stl/tpu_liner_TPU_optional.stl",
    "fit_test_ring": "stl/fit_test_ring_PLA_optional.stl",
    "assembly":      "stl/assembly_combined_view_only.stl",
    "tablet_dummy":  "build/tablet_dummy.stl",
}


def run_openscad(openscad, part, out, defines, extra=()):
    cmd = [openscad, "-D", f'part="{part}"', *extra]
    for d in defines:
        cmd += ["-D", d]
    cmd += ["-o", str(out), str(SCAD)]
    t0 = time.time()
    res = subprocess.run(cmd, capture_output=True, text=True)
    log = res.stdout + res.stderr
    errors = [l for l in log.splitlines() if l.startswith(("ERROR", "WARNING"))]
    return part, res.returncode, time.time() - t0, errors, log


def read_info(openscad, defines):
    out = ROOT / "build" / "info.echo"
    part, rc, _, errors, log = run_openscad(openscad, "info", out, defines)
    if rc != 0:
        sys.exit(f"OpenSCAD failed while reading parameters:\n{log}")
    text = out.read_text()
    model_errors = [l for l in text.splitlines() if l.startswith("ERROR")]
    if model_errors:   # failed assert() in the model (OpenSCAD still exits 0)
        sys.exit("Model check failed:\n  " + "\n  ".join(model_errors))
    info = {}
    for line in text.splitlines():
        if line.startswith('ECHO: "INFO"'):
            _, key, value = json.loads("[" + line[len("ECHO: "):] + "]")
            info[key] = value
    (ROOT / "build" / "info.json").write_text(json.dumps(info, indent=1))
    return info


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--openscad", default="openscad")
    ap.add_argument("-D", dest="defines", action="append", default=[], help="OpenSCAD -D override, e.g. -D tab_r=10")
    ap.add_argument("--only", nargs="*", help="export only these parts")
    args = ap.parse_args()

    (ROOT / "build").mkdir(exist_ok=True)
    (ROOT / "stl").mkdir(exist_ok=True)
    info = read_info(args.openscad, args.defines)
    print(f"outer {info['outer'][0]:.1f} x {info['outer'][1]:.1f} x {info['outer'][2]:.1f} mm, "
          f"windows {info['pfd'][2]-info['pfd'][0]:.1f} x {info['pfd'][3]-info['pfd'][1]:.1f} mm")

    parts = {k: v for k, v in PARTS.items() if not args.only or k in args.only}
    failed = False
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        jobs = []
        for part, rel in parts.items():
            extra = ("-D", "show_tablet=false") if part == "assembly" else ()
            jobs.append(ex.submit(run_openscad, args.openscad, part, ROOT / rel, args.defines, extra))
        for job in cf.as_completed(jobs):
            part, rc, dt, errors, log = job.result()
            status = "ok" if rc == 0 and not errors else "FAILED"
            failed |= status != "ok"
            print(f"  {part:<14} {status:<6} {dt:5.1f}s -> {parts[part]}")
            for e in errors:
                print("     ", e)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
