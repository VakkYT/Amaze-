# Assembly guide

Airbus A320-style dual PFD/ND housing for the Samsung Galaxy Tab A11 (8.7").

## What you need

| Qty | Item | Notes |
|---|---|---|
| 1 | `front_bezel_PLA.stl` | PLA / PLA+, matte blue-grey (≈ #263B50) |
| 1 | `rear_housing_PLA.stl` | PLA / PLA+, same colour |
| 1 | `desk_stand_PLA.stl` | PLA or PETG (skip it if you use a VESA arm) |
| 1 | `tpu_liner_TPU_optional.stl` | TPU 95A, optional soft back pads |
| 4 | M3 × 12 countersunk screws (ISO 10642 / DIN 7991) | bezel → housing |
| 4 | M4 hex nuts (ISO 4032) | VESA nut traps |
| 4 | M4 × 10 socket or button head screws | stand → housing |
| 4 | Rubber feet, about 10 mm (optional) | under the stand |

Tools: a 2 mm hex key or a Phillips screwdriver for the M3 screws, and a 3 mm hex key for the M4 screws.

## 1. Check the fit first (recommended)

The edge-opening positions (USB-C, jack, speakers, keys) and the tablet's corner radius are best estimates. Before you print the full housing:

1. Print `fit_test_ring_PLA_optional.stl` (≈ 1 h). It is the housing wall with its corner screw holes, centring ribs and every edge notch.
2. Drop the tablet in. It should sit with roughly 0.6 mm of play on each side and should not ride up on the corners.
3. Check that every port, speaker and key lines up with its notch.
4. If something is off, edit the `ports` table, `tab_r` or `clr_xy` in `cad/a320_tab_a11_housing.scad`, then run `python3 tools/build.py` again.

If your tablet uses the other landscape orientation (USB-C on the left), set `flip_180 = true`.

## 2. Print

| Part | Orientation | Settings |
|---|---|---|
| Front bezel | face **up**, as exported (flat back on the bed) | 0.2 mm layers, 4 walls, 5 top layers. A smooth PEI sheet gives the best seat on the glass. |
| Rear housing | back **down**, as exported | 0.2 mm, 4 walls, 20–25 % infill |
| Desk stand | base **down**, as exported | 0.2 mm, 4 walls, 25 % infill |
| TPU liner | flat | 0.2 mm, 100 % infill, slow (20–25 mm/s) |

- No supports are needed on any part. The verification script measured zero overhangs steeper than 45° on the bezel and housing; the stand has only small holes that bridge.
- The bezel and housing are 219.2 × 132.9 mm, so the bed must be at least about 222 × 135 mm.
- Use a matte filament for the cockpit look. Avoid glossy or silk PLA.

## 3. Assemble

1. **Nuts.** Press the four M4 nuts into the hexagonal traps inside the rear housing. If one is tight, pull it in with an M4 screw from the outside.
2. **Liner (optional).** Lay the TPU liner on the internal ribs. Its cut-outs match the nut bosses, the camera hole and the four springs.
3. **Tablet.** Place the tablet in the housing face up. In the default orientation the front camera is on the left, USB-C on the right and the power/volume keys on the top edge. It is centred by eight small ribs on the walls and rests on the four spring pads.
4. **Bezel.** Lay the bezel on top. The PFD window is on the left and the ND window on the right.
5. **Screws.** Fit the four M3 × 12 countersunk screws at the corners and tighten them in diagonal order. Stop when the bezel just seats on the housing rim. The screws cut their own thread in the 2.6 mm pilot holes, so don't over-tighten.
   - The four leaf springs in the back now press the tablet against the bezel with about 0.5 mm preload (about 1.1 N each), so there is no rattle.
   - It's normal for the spring tips to stand about 0.5 mm proud on the back.
6. **Mount.**
   - **Desk stand:** fit the four M4 × 10 screws through the stand plate into the nuts. This gives a 17.5° recline.
   - **Any VESA 75 arm or cockpit bracket:** use M4 screws of bracket thickness + 5 mm. The screw tip must not go more than 5.4 mm past the bracket, or it will reach the tablet.
   - **Fixed mounting:** the stand base also has four countersunk holes for screwing it to a desk or panel.

To remove the tablet, unscrew the four M3 screws and lift off the bezel.

## 4. Set up the displays

The bezel hides 15 mm (66 px) at the top and bottom of the screen, which covers the pop-out title bars and the Windows taskbar. It also hides 3 mm (22 px) at the centre for the divider. With the second-screen app at the native 1340 × 800, 1:1, place the windows like this:

| Window | Position (x, y) | Visible size |
|---|---|---|
| PFD pop-out | 0, 66 | 659 × 668 px |
| ND pop-out | 681, 66 | 659 × 668 px |

The title bars can sit in rows 0–65 and the taskbar in rows 735–799; both stay hidden.

To check alignment, show `docs/calibration_1340x800.png` full-screen on the tablet with the bezel fitted. The green frames should sit just inside both windows and no red should be visible. If something is shifted, adjust `scr_offset`, because the active-area position is estimated from the 8.7" diagonal.

## Care

- PLA softens at about 55 °C. Don't leave the unit in a hot car or in direct sun.
- The tablet back is ventilated by a 3 mm air gap and 45 rear slots arranged as a chimney (intake low, exhaust high). Don't cover the rear when it is mounted flat against a panel.
