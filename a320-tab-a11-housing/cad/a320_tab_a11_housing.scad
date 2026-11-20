// =============================================================================
//  AIRBUS A320-STYLE DUAL PFD / ND HOUSING  -  Samsung Galaxy Tab A11 (8.7")
//  Fully parametric OpenSCAD model. Units: millimetres. Tested: OpenSCAD 2021.01
// =============================================================================
//
//  Printable parts (choose with `part`, or use tools/build.py to export all):
//    front_bezel    PLA  - prints face-UP (flat back on the bed), no supports
//    rear_housing   PLA  - prints back-DOWN (open side up), no supports
//    desk_stand     PLA  - prints base-DOWN, no supports (17.5 deg recline)
//    tpu_liner      TPU  - optional protective pad grid, prints flat
//    fit_test_ring  PLA  - optional quick check of outline / ports / screws
//
//  CASE FRAME (used for every part except the stand):
//    X = tablet width, left -> right as seen from the front (landscape)
//    Y = tablet height, bottom -> top
//    Z = depth: 0 = outside of the rear housing, +Z = towards the viewer
//    The tablet footprint is [0, tab_w] x [0, tab_h].
//
//  Display layout seen from the front:   [ PFD | ND ]
//  Default orientation: front camera on the LEFT, USB-C on the RIGHT,
//  power/volume keys on the TOP edge. Set flip_180 = true for the other way.
// =============================================================================

/* [Part to render] */
part = "assembly"; // [assembly, exploded, front_bezel, rear_housing, desk_stand, tpu_liner, fit_test_ring, tablet_dummy, screen_mask, info]
show_tablet = true;        // show the tablet dummy in assembly views

/* [Tablet - Samsung Galaxy Tab A11 8.7in (measure yours!)] */
tab_w      = 211.0;        // body width  (landscape X)
tab_h      = 124.7;        // body height (landscape Y)
tab_t      = 8.0;          // body thickness
tab_r      = 8.0;          // plan-view corner radius of the body (measure; use a value <= real)
scr_diag   = 8.7;          // display diagonal [inch] - only for the screen map / checks
scr_px     = [1340, 800];  // display resolution
scr_offset = [0, 0];       // active-area centre offset from body centre [mm]

/* [Tolerances] */
clr_xy  = 0.6;             // clearance tablet edge -> cavity wall, per side (0.5..1.0)
clr_z   = 0.4;             // free depth play, taken up by the retention springs
fit     = 0.2;             // generic clearance for printed mating features

/* [Front bezel borders - coverage of the tablet face, measured from the tablet edge] */
border_top    = 15;        // hides the Windows pop-out title bars
border_bottom = 15;        // hides the Windows taskbar
border_left   = 5;
border_right  = 5;
divider_w     = 3.0;       // central PFD/ND divider width at the glass
border_datum  = "tablet";  // [tablet, outer] "outer" = borders measured from the case outside edge

/* [Housing] */
wall          = 3.5;       // side wall thickness
t_back        = 3.2;       // rear plate thickness
gap_rear      = 3.0;       // air gap behind the tablet (ventilation + pads)
housing_depth = 0;         // 0 = automatic; otherwise total rear-housing depth (extra goes to gap_rear)
corner_r      = 3.0;       // external plan-view corner radius ("slightly rounded")
edge_ch       = 0.6;       // chamfer on the outer front and back edges
seam_ch       = 0.4;       // small chamfers either side of the bezel/housing seam

/* [Bezel styling] */
bezel_t     = 2.2;         // bezel plate thickness over the glass
rim_w       = 3.0;         // raised display surround width (from the window edge)
rim_h       = 0.8;         // raised display surround height
win_r       = 1.5;         // window corner radius
win_draft   = 1.0;         // outer window edges open up by this much at the front face
div_draft   = 0.4;         // each divider flank leans in by this much at the front face
div_crown_h = 0.4;         // extra raised crown on the divider ("slightly raised profile")
labels      = false;       // debossed "PFD" / "ND" labels in the lower border
label_size  = 4;

/* [Bezel screws - countersunk, 4 corners] */
screw_d       = 3;         // M3
screw_mode    = "thread";  // [thread, insert] thread = screw cuts its own thread in PLA
pilot_d       = 2.6;       // pilot hole for "thread" mode
insert_hole_d = 4.0;       // heat-set insert hole for "insert" mode
insert_len    = 5.0;
clear_d       = 3.4;       // clearance hole in the bezel
csk_d         = 6.4;       // countersink diameter at the surface (90 deg)
screw_len     = 12;        // M3 x 12 countersunk (ISO 10642 / DIN 7991)

/* [Tablet retention] */
spring_len   = 30;         // PLA leaf-spring tongue length
spring_w     = 12;
spring_t     = 1.8;        // tongue thickness (rear plate is t_back)
spring_slot  = 1.2;        // U-slot width around the tongue
spring_pre   = 0.5;        // spring preload (deflection with the tablet installed)
spring_bump  = 6;          // contact pad size on the tongue tip
spring_xoff  = 62.5;       // spring X offset from the centre
spring_tip_y = 9;          // tongue tip distance from the tablet top/bottom edge
locator_r    = 1.2;        // centring ribs on the cavity walls
locator_gap  = 0.2;        // remaining clearance at a centring rib
use_tpu      = true;       // lower the PLA ribs by tpu_t to make room for the TPU liner
tpu_t        = 0.8;
tpu_strip_w  = 4;
rib_w        = 2.0;        // PLA standoff ribs behind the tablet
rib_pitch    = 25;
rib_count    = 3;          // ribs each side of the centre rib
ring_inset   = 4;          // perimeter standoff ring, inset from the tablet edge

/* [Ventilation] */
vent_w           = 3;
vent_len         = 22;
vent_pitch       = 6;
vent_per_channel = 3;
vent_edge_y      = 21;     // centre of the lower / upper vent rows from the tablet edge
vent_margin      = 2;

/* [Mounting - VESA pattern on the flat rear face] */
vesa        = 75;          // 75 x 75 mm (MIS-D 75)
vesa_hole_d = 4.5;         // M4 clearance
nut_af      = 7.0;         // M4 hex nut across flats
nut_h       = 3.2;
boss_d      = 12;

/* [Desk stand] */
stand_tilt     = 17.5;     // rear inclination from vertical (15..20)
stand_w        = 120;
stand_front    = 18;       // base extends this far in front of the mounting plane
stand_depth    = 120;      // base extends this far behind the mounting plane
stand_base_t   = 5;
stand_plate    = 100;      // square mounting plate
stand_plate_t  = 6;
stand_frame    = 20;       // width of the frame bars around the airflow window
stand_gusset_t = 5;
stand_gusset_x = 46;
stand_clear    = 3;        // clearance between case bottom and the base top

/* [Orientation / openings] */
flip_180         = false;  // rotate all port/camera positions by 180 deg
front_cam_cutout = true;
front_cam_xy     = [5.3, 124.7/2];  // front camera (left bezel, centred)
front_cam_r      = 2.5;
rear_cam_xy      = [13, 124.7 - 13]; // rear camera, as seen from the FRONT
rear_cam_d       = 14;
rear_cam_ch      = 1.5;

// Edge openings. pos = centre along the edge measured from the left (top/bottom
// edges) or from the bottom (left/right edges). height = how far the notch
// reaches below the tablet mid-plane x2. Notches are open towards the front
// (closed by the bezel), so they print without bridges.
// ALL POSITIONS ARE BEST ESTIMATES - CHECK WITH fit_test_ring FIRST.
//        name               edge     pos              width height z_off relief
ports = [["USB-C",           "right", 124.7/2,         14,   9.0,  0,    0],
         ["Speaker R (low)", "right", 124.7/2 - 32,    24,   5.0,  0,    0],
         ["Speaker R (high)","right", 124.7/2 + 32,    24,   5.0,  0,    0],
         ["3.5mm jack / mic","left",  124.7/2,         14,   9.0,  0,    0],
         ["Speaker L (low)", "left",  124.7/2 - 32,    24,   5.0,  0,    0],
         ["Speaker L (high)","left",  124.7/2 + 32,    24,   5.0,  0,    0],
         ["Power + volume",  "top",   47.5,            55,   6.0,  0,    1]];
relief_wall = 1.2;         // wall left at a finger relief

/* [Colours (preview only)] */
col_panel  = "#263B50";    // Airbus-style blue-grey, matte
col_tpu    = "#1A1A1A";
col_tablet = "#2B2B2E";
col_screen = "#050608";

$fa = 5; $fs = 0.5;
eps = 0.01;

// =============================================================================
//  DERIVED VALUES
// =============================================================================
o        = clr_xy + wall;                     // tablet edge -> outside
out_w    = tab_w + 2*o;
out_h    = tab_h + 2*o;
gap_r    = housing_depth > 0 ? housing_depth - t_back - tab_t - clr_z : gap_rear;
z_floor  = t_back;
shell_h  = t_back + gap_r + tab_t + clr_z;    // rear housing height = bezel seat
z_rim    = shell_h;
z_tab_f  = z_rim;                             // tablet front when clamped
z_tab_b  = z_rim - tab_t;
z_tab_m  = z_rim - tab_t/2;
rib_h    = gap_r - (use_tpu ? tpu_t : 0);
boss_h   = gap_r - 0.3;
nut_pocket = nut_h + 0.4;
case_under_nut = z_floor + boss_h - nut_pocket;
bezel_top  = bezel_t + rim_h;                 // top of the display surround
total_depth = shell_h + bezel_top + div_crown_h;

// border coverage measured from the tablet edge
cov_t = border_datum == "outer" ? border_top    - o : border_top;
cov_b = border_datum == "outer" ? border_bottom - o : border_bottom;
cov_l = border_datum == "outer" ? border_left   - o : border_left;
cov_r = border_datum == "outer" ? border_right  - o : border_right;

ap     = [cov_l, cov_b, tab_w - cov_r, tab_h - cov_t];   // aperture at the glass
div_cx = (ap[0] + ap[2]) / 2;                            // divider centre line
pfd    = [ap[0], ap[1], div_cx - divider_w/2, ap[3]];
nd     = [div_cx + divider_w/2, ap[1], ap[2], ap[3]];

// display active area estimate (from the diagonal)
scr_diag_mm = scr_diag * 25.4;
scr_w  = scr_diag_mm * scr_px[0] / sqrt(scr_px[0]*scr_px[0] + scr_px[1]*scr_px[1]);
scr_hh = scr_diag_mm * scr_px[1] / sqrt(scr_px[0]*scr_px[0] + scr_px[1]*scr_px[1]);
scr_x0 = tab_w/2 + scr_offset[0] - scr_w/2;
scr_y0 = tab_h/2 + scr_offset[1] - scr_hh/2;
px_mm  = scr_w / scr_px[0];
function to_px_x(x) = (x - scr_x0) / px_mm;
function to_px_y_top(y) = (scr_y0 + scr_hh - y) / px_mm;   // pixel row from the top

// screw positions: on the corner diagonals, balanced between the countersink
// edge -> outside and the pilot hole -> cavity
hole_r   = (screw_mode == "insert" ? insert_hole_d : pilot_d) / 2;
screw_in = ((sqrt(2) - 1) * tab_r - clr_xy - hole_r - o + csk_d/2) / (1 + sqrt(2));
screw_pts = [[screw_in, screw_in], [tab_w - screw_in, screw_in],
             [screw_in, tab_h - screw_in], [tab_w - screw_in, tab_h - screw_in]];
screw_edge_margin = o + screw_in - csk_d/2;
screw_wall_margin = sqrt(2) * (tab_r - screw_in) - (tab_r + clr_xy) - hole_r;

vesa_pts = [for (sx = [-1, 1], sy = [-1, 1]) [tab_w/2 + sx*vesa/2, tab_h/2 + sy*vesa/2]];

// orientation mapping
function fx(x) = flip_180 ? tab_w - x : x;
function fy(y) = flip_180 ? tab_h - y : y;
function map_xy(p) = [fx(p[0]), fy(p[1])];
function map_edge(e) = !flip_180 ? e :
    (e == "left" ? "right" : e == "right" ? "left" : e == "top" ? "bottom" : "top");
function map_pos(e, p) = !flip_180 ? p :
    ((e == "left" || e == "right") ? tab_h - p : tab_w - p);
ports_m  = [for (p = ports) [p[0], map_edge(p[1]), map_pos(p[1], p[2]), p[3], p[4], p[5], p[6]]];
cam_r_c  = map_xy(rear_cam_xy);
cam_f_c  = map_xy(front_cam_xy);

// retention springs: [x, tip y, direction of the root (+1 up / -1 down)]
spring_list = [[tab_w/2 - spring_xoff, spring_tip_y, 1],
               [tab_w/2 + spring_xoff, spring_tip_y, 1],
               [tab_w/2 - spring_xoff, tab_h - spring_tip_y, -1],
               [tab_w/2 + spring_xoff, tab_h - spring_tip_y, -1]];
function spring_rect(s) = let(
    x0 = s[0] - spring_w/2 - spring_slot, x1 = s[0] + spring_w/2 + spring_slot,
    ya = s[1] - s[2]*spring_slot,          yb = s[1] + s[2]*spring_len)
    [x0, min(ya, yb), x1, max(ya, yb)];
spring_bump_top = z_floor + gap_r + clr_z + spring_pre;
spring_k = 3 * 3500 * (spring_w * pow(spring_t, 3) / 12) / pow(spring_len, 3);  // N/mm, PLA E~3.5GPa

// keep-out zones on the rear floor (circles [x,y,r] and rects [x0,y0,x1,y1])
ko_circles = concat([[cam_r_c[0], cam_r_c[1], rear_cam_d/2 + 1.5]],
                    [for (p = vesa_pts) [p[0], p[1], boss_d/2]]);
ko_rects   = [for (s = spring_list) spring_rect(s)];

// standoff ribs and vent channels
rib_xs = [for (k = [-rib_count : rib_count]) tab_w/2 + k*rib_pitch];
channel_xs = concat([(ring_inset + rib_xs[0]) / 2],
                    [for (i = [0 : len(rib_xs) - 2]) (rib_xs[i] + rib_xs[i+1]) / 2],
                    [(rib_xs[len(rib_xs) - 1] + tab_w - ring_inset) / 2]);
vent_rows = [vent_edge_y, tab_h/2, tab_h - vent_edge_y];
vent_span = (vent_per_channel - 1) * vent_pitch + vent_w;

function rc_hit(r, c, m) = let(qx = max(r[0], min(c[0], r[2])), qy = max(r[1], min(c[1], r[3])))
    (c[0]-qx)*(c[0]-qx) + (c[1]-qy)*(c[1]-qy) < (c[2]+m)*(c[2]+m);
function rr_hit(a, b, m) = !(a[2] + m <= b[0] || b[2] + m <= a[0] || a[3] + m <= b[1] || b[3] + m <= a[1]);
function zone_ok(r) =
    len([for (c = ko_circles) if (rc_hit(r, c, vent_margin)) 1]) == 0 &&
    len([for (k = ko_rects)   if (rr_hit(r, k, vent_margin)) 1]) == 0;
vent_groups = [for (cx = channel_xs, cy = vent_rows)
                 let(r = [cx - vent_span/2, cy - vent_len/2, cx + vent_span/2, cy + vent_len/2])
                 if (zone_ok(r)) [cx, cy]];

// desk stand geometry (stand frame: X across, Y backwards, Z up, desk at Z=0;
// the mounting plane passes through Y=0,Z=0 and leans back by stand_tilt)
s_bot = (stand_base_t + stand_clear) / cos(stand_tilt);  // case bottom edge, along the incline
s_c   = s_bot + out_h/2;                                 // VESA centre, along the incline
stand_cb = 1.2;                                           // counterbore under the M4 heads
vesa_screw_tip = -(stand_plate_t - stand_cb) + 10;        // with M4 x 10, in case Z

// =============================================================================
//  SANITY CHECKS
// =============================================================================
assert(gap_r >= 1.5, "housing_depth too small: rear gap < 1.5 mm");
assert(cov_l >= 0 && cov_r >= 0 && cov_t >= 0 && cov_b >= 0, "border smaller than the case wall");
assert(abs((pfd[2] - pfd[0]) - (nd[2] - nd[0])) < 1e-6, "PFD/ND windows not symmetric");
assert(screw_wall_margin > 0.5, str("Corner screw breaks into the cavity (", screw_wall_margin,
       " mm). Re-measure tab_r, increase wall, or use screw_mode=\"thread\" / a smaller screw."));
assert(screw_edge_margin > 0.5, "Countersink too close to the outer edge - increase wall");
assert(boss_h > nut_pocket + 0.5 - z_floor, "Rear plate too thin for the M4 nut traps");
assert(vesa_screw_tip < z_floor + boss_h, "VESA screw would reach the tablet");

// =============================================================================
//  2D HELPERS
// =============================================================================
module rrect(x0, y0, x1, y1, r) {
    w = x1 - x0; h = y1 - y0;
    rr = max(0.01, min(r, w/2 - 0.01, h/2 - 0.01));
    translate([x0 + rr, y0 + rr]) offset(r = rr) square([w - 2*rr, h - 2*rr]);
}
module stadium(x0, y0, x1, y1) {
    r = min(x1 - x0, y1 - y0) / 2;
    hull() { translate([x0 + r, y0 + r]) circle(r); translate([x1 - r, y1 - r]) circle(r); }
}
module outer_2d(g = 0)  rrect(-o - g, -o - g, tab_w + o + g, tab_h + o + g, corner_r + g);
module cavity_2d(g = 0) rrect(-clr_xy - g, -clr_xy - g, tab_w + clr_xy + g, tab_h + clr_xy + g, tab_r + clr_xy + g);
module tablet_2d()      rrect(0, 0, tab_w, tab_h, tab_r);

// solid of the outer outline, height h, with bottom/top edge chamfers
module outer_slab(h, cb = 0, ct = 0) {
    hull() {
        if (cb > 0) linear_extrude(eps) outer_2d(-cb);
        translate([0, 0, cb]) linear_extrude(h - cb - ct) outer_2d();
        if (ct > 0) translate([0, 0, h - eps]) linear_extrude(eps) outer_2d(-ct);
    }
}

// floor keep-outs (rear camera, nut bosses, springs)
module keepouts_2d(m = 0) {
    for (c = ko_circles) translate([c[0], c[1]]) circle(r = c[2] + m);
    for (r = ko_rects) translate([r[0] - m, r[1] - m]) square([r[2] - r[0] + 2*m, r[3] - r[1] + 2*m]);
}

// perimeter ring + vertical ribs (shared by the PLA ribs and the TPU liner)
module rib_layout_2d(w) {
    rr = max(1, tab_r - ring_inset);
    difference() {
        rrect(ring_inset - w/2, ring_inset - w/2, tab_w - ring_inset + w/2, tab_h - ring_inset + w/2, rr + w/2);
        rrect(ring_inset + w/2, ring_inset + w/2, tab_w - ring_inset - w/2, tab_h - ring_inset - w/2, max(0.5, rr - w/2));
    }
    for (x = rib_xs) translate([x - w/2, ring_inset]) square([w, tab_h - 2*ring_inset]);
}

// =============================================================================
//  FRONT BEZEL  (local Z = 0 at its underside; sits at z_rim in the case)
// =============================================================================
module front_bezel() {
    difference() {
        union() {
            outer_slab(bezel_t, seam_ch, edge_ch);
            display_surround();
            central_divider();
        }
        pfd_opening();
        nd_opening();
        if (front_cam_cutout) front_camera_cutout();
        bezel_screw_holes();
        if (labels) bezel_labels();
    }
}

// raised surround around both displays (the divider strip is part of it)
module display_surround() {
    hull() {
        translate([0, 0, bezel_t - eps]) linear_extrude(eps)
            rrect(ap[0] - rim_w, ap[1] - rim_w, ap[2] + rim_w, ap[3] + rim_w, win_r + rim_w);
        translate([0, 0, bezel_top - eps]) linear_extrude(eps)
            rrect(ap[0] - rim_w + rim_h, ap[1] - rim_w + rim_h, ap[2] + rim_w - rim_h, ap[3] + rim_w - rim_h,
                  win_r + rim_w - rim_h);
    }
}

// one display window cutter; exact size at the glass, drafted towards the front
module window_cutter(w, dl, dr) {
    translate([0, 0, -1]) linear_extrude(1 + eps) rrect(w[0], w[1], w[2], w[3], win_r);
    hull() {   // draft starts exactly at the glass plane (z = 0)
        linear_extrude(eps) rrect(w[0], w[1], w[2], w[3], win_r);
        translate([0, 0, bezel_top]) linear_extrude(eps)
            rrect(w[0] - dl, w[1] - win_draft, w[2] + dr, w[3] + win_draft, win_r + min(dl, dr));
    }
    translate([0, 0, bezel_top]) linear_extrude(div_crown_h + 2)
        rrect(w[0] - dl, w[1] - win_draft, w[2] + dr, w[3] + win_draft, win_r + min(dl, dr));
}

// PFD (left) window, ND (right) window = exact mirror about the divider centre line
module pfd_opening() window_cutter(pfd, win_draft, div_draft);
module nd_opening()  translate([2*div_cx, 0, 0]) mirror([1, 0, 0]) pfd_opening();

// central divider: the strip left between the windows (divider_w at the glass,
// flanks leaning in by div_draft) plus a slightly raised crown on top of it
module central_divider() {
    wt = divider_w - 2*div_draft;
    y0 = ap[1] - rim_w/2; y1 = ap[3] + rim_w/2;
    if (div_crown_h > 0)
        translate([div_cx, 0, bezel_top - eps]) hull() {
            translate([-wt/2, y0, 0]) cube([wt, y1 - y0, eps]);
            translate([-wt/2 + 0.2, y0 + div_crown_h, div_crown_h]) cube([wt - 0.4, y1 - y0 - 2*div_crown_h, eps]);
        }
}

module front_camera_cutout()
    translate([cam_f_c[0], cam_f_c[1], -1])
        cylinder(h = bezel_top + 3, r1 = front_cam_r, r2 = front_cam_r + (bezel_top + 3) * 0.35);

module bezel_screw_holes() {
    cd = (csk_d - clear_d) / 2;
    for (p = screw_pts) translate([p[0], p[1], 0]) {
        translate([0, 0, -1]) cylinder(h = bezel_t + 2, d = clear_d);
        translate([0, 0, bezel_t - cd]) cylinder(h = cd + eps, d1 = clear_d, d2 = csk_d);
        translate([0, 0, bezel_t]) cylinder(h = 2, d = csk_d);
    }
}

module bezel_labels()
    for (l = [["PFD", (pfd[0] + pfd[2]) / 2], ["ND", (nd[0] + nd[2]) / 2]])
        translate([l[1], (ap[1] - rim_w) / 2 - o/2, bezel_t - 0.4])
            linear_extrude(1) text(l[0], size = label_size, halign = "center", valign = "center",
                                   font = "Liberation Sans:style=Bold");

// =============================================================================
//  REAR HOUSING
// =============================================================================
module rear_housing() {
    difference() {
        union() {
            shell_body();
            standoff_ribs();
            mounting_interface("add");
            tablet_retention_clips("add_locators");
        }
        port_cutouts();
        corner_screw_holes();
        translate([0, 0, -1]) linear_extrude(z_floor + 1.5) vents_2d();
        rear_camera_hole();
        mounting_interface("cut");
        tablet_retention_clips("cut");
    }
    tablet_retention_clips("add_springs");
}

module shell_body() {
    ff = 0.8;   // floor-to-wall fillet (chamfer)
    difference() {
        outer_slab(shell_h, edge_ch, seam_ch);
        hull() {
            translate([0, 0, z_floor]) linear_extrude(eps) cavity_2d(-ff);
            translate([0, 0, z_floor + ff]) linear_extrude(shell_h) cavity_2d();
        }
    }
}

module standoff_ribs()
    translate([0, 0, z_floor - eps]) linear_extrude(rib_h + eps)
        difference() { rib_layout_2d(rib_w); keepouts_2d(1); }

module vents_2d()
    for (g = vent_groups, i = [0 : vent_per_channel - 1]) {
        x = g[0] + (i - (vent_per_channel - 1) / 2) * vent_pitch;
        stadium(x - vent_w/2, g[1] - vent_len/2, x + vent_w/2, g[1] + vent_len/2);
    }

module rear_camera_hole()
    translate([cam_r_c[0], cam_r_c[1], -1]) {
        cylinder(d = rear_cam_d, h = z_floor + 2);
        cylinder(d1 = rear_cam_d + 2*(1 + rear_cam_ch), d2 = rear_cam_d, h = 1 + rear_cam_ch);
    }

module corner_screw_holes()
    for (p = screw_pts) translate([p[0], p[1], 0]) {
        if (screw_mode == "insert") {
            translate([0, 0, shell_h - insert_len]) cylinder(d = insert_hole_d, h = insert_len + 1);
            translate([0, 0, shell_h - (screw_len - bezel_t) - 1.5]) cylinder(d = screw_d + 0.2, h = screw_len);
        } else {
            translate([0, 0, shell_h - (screw_len - bezel_t) - 1.5]) cylinder(d = pilot_d, h = screw_len);
            translate([0, 0, shell_h - 0.6]) cylinder(d1 = pilot_d, d2 = pilot_d + 1.2, h = 0.6 + eps);
        }
    }

// ---- Charging, speaker, jack and button cutouts -----------------------------
// local frame per edge: u along the edge, n = outward distance from the tablet edge
module on_edge(e, pos) {
    if (e == "bottom")     translate([pos, 0, 0]) mirror([0, 1, 0]) children();
    else if (e == "top")   translate([pos, tab_h, 0]) children();
    else if (e == "left")  translate([0, pos, 0]) rotate([0, 0, 90]) children();
    else if (e == "right") translate([tab_w, pos, 0]) rotate([0, 0, -90]) children();
}
module port_cutouts() for (p = ports_m) port_cut(p);
module port_cut(p) {
    w = p[3]; zb = z_tab_m + p[5] - p[4]/2; nr = 1.5;
    on_edge(p[1], p[2]) {
        // notch through the wall, open towards the front (closed by the bezel)
        hull() {
            for (s = [-1, 1]) translate([s*(w/2 - nr), -1, zb + nr]) rotate([-90, 0, 0]) cylinder(r = nr, h = o + 2);
            translate([-w/2, -1, shell_h]) cube([w, o + 2, 1]);
        }
        // finger relief for buttons: thins the wall around the notch from outside
        if (p[6] > 0) hull() {
            rr = 3; wr = w + 10;
            for (s = [-1, 1]) translate([s*(wr/2 - rr), clr_xy + relief_wall, zb - 1.5 + rr])
                rotate([-90, 0, 0]) cylinder(r = rr, h = o);
            translate([-wr/2, clr_xy + relief_wall, shell_h]) cube([wr, o, 1]);
        }
    }
}

// ---- Tablet retention: PLA leaf springs + centring ribs ----------------------
//  "cut"          : U-slots through the rear plate + thinning of each tongue
//  "add_springs"  : contact pads on the tongue tips (preload = spring_pre)
//  "add_locators" : half-round centring ribs on the cavity walls
module spring_frame(s) translate([s[0], s[1], 0]) mirror([0, s[2] < 0 ? 1 : 0, 0]) children();
module tablet_retention_clips(mode) {
    if (mode == "cut") for (s = spring_list) spring_frame(s) {
        // U-shaped slot (open at the root end, round slot ends for stress relief)
        translate([0, 0, -1]) linear_extrude(z_floor + 2) difference() {
            union() {
                translate([-spring_w/2 - spring_slot, -spring_slot]) square([spring_w + 2*spring_slot, spring_len + spring_slot]);
                for (sx = [-1, 1]) translate([sx*(spring_w/2 + spring_slot/2), spring_len]) circle(d = spring_slot);
            }
            translate([-spring_w/2, 0]) square([spring_w, spring_len + 1]);
        }
        // thin the tongue from the inside so it flexes (outer face stays on the bed)
        translate([-spring_w/2, 0, spring_t]) cube([spring_w, spring_len, z_floor]);
    }
    if (mode == "add_springs") for (s = spring_list) spring_frame(s) {
        b = spring_bump; h = spring_bump_top - spring_t; c = 1.0;
        translate([0, 1 + b/2, spring_t - eps]) hull() {
            translate([-b/2, -b/2, 0]) cube([b, b, h - c]);
            translate([-b/2 + c, -b/2 + c, 0]) cube([b - 2*c, b - 2*c, h]);
        }
        // fill the slot between pad and wall? no - tongue must stay free
    }
    if (mode == "add_locators") {
        lh = clr_xy - locator_gap;       // how far a rib protrudes into the clearance
        z0 = z_floor - eps; z1 = z_rim - 0.3;     // rise from the floor: no overhang
        locs = [for (x = [tab_w/2 - 20, tab_w/2 + 20]) ["bottom", x],
                for (x = [tab_w/2 - 20, tab_w/2 + 20]) ["top", x],
                for (y = [tab_h/2 - 50, tab_h/2 + 50]) ["left", y],
                for (y = [tab_h/2 - 50, tab_h/2 + 50]) ["right", y]];
        for (l = locs) on_edge(l[0], l[1])
            translate([0, clr_xy - lh + locator_r, 0]) {
                translate([0, 0, z0]) cylinder(r = locator_r, h = z1 - z0 - 1.5);
                translate([0, 0, z1 - 1.5 - eps]) cylinder(r1 = locator_r, r2 = locator_r - lh, h = 1.5);
            }
    }
}

// ---- Mounting interface: VESA 75 M4 nut traps in the rear plate --------------
module mounting_interface(mode) {
    if (mode == "add") for (p = vesa_pts) translate([p[0], p[1], z_floor - eps]) cylinder(d = boss_d, h = boss_h + eps);
    if (mode == "cut") for (p = vesa_pts) translate([p[0], p[1], 0]) {
        translate([0, 0, -1]) cylinder(d = vesa_hole_d, h = z_floor + boss_h + 2);
        translate([0, 0, z_floor + boss_h - nut_pocket]) rotate([0, 0, 30])
            cylinder(d = (nut_af + 0.3) / cos(30), h = nut_pocket + 1, $fn = 6);
    }
}

// =============================================================================
//  OPTIONAL TPU PROTECTIVE LINER  (lies on the PLA ribs, under the tablet)
// =============================================================================
module tpu_liner()
    linear_extrude(tpu_t) difference() {
        rib_layout_2d(tpu_strip_w);
        keepouts_2d(1 + (tpu_strip_w - rib_w) / 2);
    }

// =============================================================================
//  FIT TEST RING  (walls, corner screws, centring ribs and edge cutouts only)
// =============================================================================
module fit_test_ring()
    intersection() {
        rear_housing();
        translate([0, 0, -1]) linear_extrude(shell_h + 2) difference() { outer_2d(1); cavity_2d(-8); }
    }

// =============================================================================
//  MOUNTING BRACKET: DESK STAND  (stand frame, see derived values)
// =============================================================================
module tilt() rotate([-stand_tilt, 0, 0]) children();
function pm(s, t) = [s*sin(stand_tilt) + t*cos(stand_tilt), s*cos(stand_tilt) - t*sin(stand_tilt)];

module desk_stand() {
    P = stand_plate; F = stand_frame;
    s_top = s_c + P/2;
    s_g = s_top - 12;
    difference() {
        union() {
            // base
            translate([0, 0, 0]) linear_extrude(stand_base_t)
                rrect(-stand_w/2, -stand_front, stand_w/2, stand_depth, 6);
            // mounting plate: solid web down to the base, airflow window with a
            // 45 deg roof so the plate prints upright without supports
            tilt() rotate([90, 0, 0]) translate([0, 0, -stand_plate_t])
                linear_extrude(stand_plate_t) difference() {
                    translate([-P/2, 0]) square([P, s_top]);
                    stand_window_2d();
                }
            // gussets
            for (sx = [-1, 1]) translate([sx*stand_gusset_x - stand_gusset_t/2, 0, 0])
                rotate([90, 0, 90]) linear_extrude(stand_gusset_t)
                    polygon([pm(0, stand_plate_t/2) - [0, 2], pm(s_g, stand_plate_t/2),
                             [stand_depth - 12, stand_base_t + 4], [stand_depth - 12, -2]]);
        }
        // nothing below the desk
        translate([-500, -500, -100]) cube([1000, 1000, 100]);
        // VESA holes with counterbores on the back
        tilt() for (p = [[-1, -1], [-1, 1], [1, -1], [1, 1]])
            translate([p[0]*vesa/2, 0, s_c + p[1]*vesa/2]) rotate([-90, 0, 0]) {
                translate([0, 0, -1]) cylinder(d = vesa_hole_d, h = stand_plate_t + 2);
                translate([0, 0, stand_plate_t - stand_cb]) cylinder(d = 8.6, h = stand_cb + 1);
            }
        // desk fixing holes (countersunk, for wood screws or M4)
        for (p = [[-1, 55], [1, 55], [-1, stand_depth - 10], [1, stand_depth - 10]])
            translate([p[0]*(stand_w/2 - 9), p[1], 0]) {
                translate([0, 0, -1]) cylinder(d = 4.5, h = stand_base_t + 2);
                translate([0, 0, stand_base_t - 2.2]) cylinder(d1 = 4.5, d2 = 9, h = 2.2 + eps);
            }
    }
}

module stand_window_2d() {
    a = stand_plate/2 - stand_frame;
    polygon([[-a, s_c - a], [a, s_c - a], [a, s_c], [0, s_c + a], [-a, s_c]]);
}

// place case-frame geometry onto the stand (VESA centre on the plate)
module on_stand()
    translate([0, s_c*sin(stand_tilt), s_c*cos(stand_tilt)]) rotate([-stand_tilt, 0, 0])
        rotate([90, 0, 0]) translate([-tab_w/2, -tab_h/2, 0]) children();

// =============================================================================
//  TABLET DUMMY + SCREEN MASK (visualisation and fit checks)
// =============================================================================
module tablet_dummy() {
    translate([0, 0, z_tab_b]) color(col_tablet) linear_extrude(tab_t - 0.05) tablet_2d();
    color(col_screen) translate([scr_x0, scr_y0, z_tab_f - 0.05]) cube([scr_w, scr_hh, 0.05]);
}
module screen_mask() // the visible screen region seen through the bezel, at the glass
    intersection() {
        translate([scr_x0, scr_y0]) square([scr_w, scr_hh]);
        union() { rrect(pfd[0], pfd[1], pfd[2], pfd[3], win_r); rrect(nd[0], nd[1], nd[2], nd[3], win_r); }
    }

// =============================================================================
//  ASSEMBLIES
// =============================================================================
module case_assembly(ex = 0) {
    color(col_panel) rear_housing();
    if (use_tpu) color(col_tpu) translate([0, 0, z_floor + rib_h + ex*0.6]) tpu_liner();
    if (show_tablet) translate([0, 0, ex*1.4]) tablet_dummy();
    color(col_panel) translate([0, 0, z_rim + ex*2.6]) front_bezel();
}
module assembly() {
    on_stand() case_assembly(0);
    color(col_panel) desk_stand();
}
module exploded() {
    on_stand() translate([0, 0, 20]) case_assembly(22);
    color(col_panel) desk_stand();
}

// =============================================================================
//  INFO (machine-readable summary for tools/build.py)
// =============================================================================
module info() {
    echo("INFO", "tablet", [tab_w, tab_h, tab_t, tab_r]);
    echo("INFO", "clearance", [clr_xy, clr_z]);
    echo("INFO", "outer", [out_w, out_h, total_depth]);
    echo("INFO", "outer_origin", [-o, -o]);
    echo("INFO", "wall", [wall, o]);
    echo("INFO", "z", [z_floor, z_tab_b, z_tab_f, z_rim, bezel_t, bezel_top, div_crown_h, shell_h]);
    echo("INFO", "borders_cov", [cov_t, cov_b, cov_l, cov_r]);
    echo("INFO", "borders_visible", [cov_t + o, cov_b + o, cov_l + o, cov_r + o]);
    echo("INFO", "aperture", ap);
    echo("INFO", "pfd", pfd);
    echo("INFO", "nd", nd);
    echo("INFO", "divider", [div_cx, divider_w, divider_w - 2*div_draft, bezel_top + div_crown_h]);
    echo("INFO", "rim", [rim_w, rim_h, win_r, win_draft, div_draft]);
    echo("INFO", "screen_mm", [scr_x0, scr_y0, scr_w, scr_hh, px_mm]);
    echo("INFO", "pfd_px", [max(0, to_px_x(pfd[0])), to_px_y_top(pfd[3]), to_px_x(pfd[2]), to_px_y_top(pfd[1])]);
    echo("INFO", "nd_px",  [to_px_x(nd[0]), to_px_y_top(nd[3]), min(scr_px[0], to_px_x(nd[2])), to_px_y_top(nd[1])]);
    echo("INFO", "screws", screw_pts);
    echo("INFO", "screw_margins", [screw_edge_margin, screw_wall_margin, screw_in]);
    echo("INFO", "screw_spec", [screw_d, screw_len, screw_mode, pilot_d, csk_d]);
    echo("INFO", "vesa", [vesa, vesa_pts]);
    echo("INFO", "vesa_nut", [case_under_nut, nut_h, boss_h, vesa_screw_tip]);
    echo("INFO", "ports", ports_m);
    echo("INFO", "rear_cam", [cam_r_c[0], cam_r_c[1], rear_cam_d]);
    echo("INFO", "front_cam", [cam_f_c[0], cam_f_c[1], front_cam_r, front_cam_cutout]);
    echo("INFO", "springs", [spring_list, spring_len, spring_w, spring_t, spring_pre, spring_k, spring_bump_top]);
    echo("INFO", "ribs", [rib_xs, rib_w, rib_h, ring_inset]);
    echo("INFO", "vents", [len(vent_groups) * vent_per_channel, vent_w, vent_len]);
    echo("INFO", "stand", [stand_tilt, s_bot, s_c, stand_plate, stand_plate_t, stand_w, stand_front, stand_depth]);
    echo("INFO", "colour", col_panel);
}

// =============================================================================
//  PART SELECTOR
// =============================================================================
if      (part == "assembly")      assembly();
else if (part == "exploded")      exploded();
else if (part == "front_bezel")   front_bezel();
else if (part == "rear_housing")  rear_housing();
else if (part == "desk_stand")    desk_stand();
else if (part == "tpu_liner")     tpu_liner();
else if (part == "fit_test_ring") fit_test_ring();
else if (part == "tablet_dummy")  tablet_dummy();
else if (part == "screen_mask")   linear_extrude(0.2) screen_mask();
else if (part == "info")          { info(); cube(1); }
