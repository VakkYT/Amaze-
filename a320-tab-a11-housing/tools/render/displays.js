// Generic, simplified PFD / ND mock-ups drawn on a 2D canvas for the preview
// renders only (not real avionics artwork). The whole 1340 x 800 tablet screen
// is drawn, including a fake window title bar and taskbar so the renders show
// the bezel hiding them.

const GREEN = '#25e05a', CYAN = '#2fd7e8', AMBER = '#ffb000', YELLOW = '#ffe12b',
      WHITE = '#f2f2f2', MAGENTA = '#ff4fd8', GREY = '#55595e', SKY = '#2a7fd6', GROUND = '#8a5a2b';
const FONT = '"DejaVu Sans", "Liberation Sans", sans-serif';

function text(ctx, s, x, y, size, color, align = 'center', base = 'middle') {
  ctx.font = `${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
}

function titleBar(ctx, x, w, title) {
  // fake pop-out window chrome (hidden behind the 15 mm top border)
  ctx.fillStyle = '#e9e9ea'; ctx.fillRect(x, 0, w, 62);
  text(ctx, title, x + 16, 31, 22, '#222', 'left');
  ['—', '☐', '✕'].forEach((g, i) => text(ctx, g, x + w - 30 - i * 46, 31, 22, '#333'));
}

function taskbar(ctx, W) {
  // fake taskbar (hidden behind the 15 mm bottom border)
  ctx.fillStyle = '#1f2330'; ctx.fillRect(0, 740, W, 60);
  for (let i = 0; i < 7; i++) { ctx.fillStyle = i === 0 ? '#3d7be0' : '#59606e'; ctx.fillRect(520 + i * 46, 754, 30, 30); }
  text(ctx, '12:34', W - 60, 770, 20, '#ddd');
}

export function drawPFD(ctx, x0, y0, w, h, t = 0) {
  ctx.save(); ctx.translate(x0, y0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const s = h / 668;
  // --- flight mode annunciator strip
  const fmaH = 72 * s;
  ctx.strokeStyle = GREY; ctx.lineWidth = 2 * s;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(w * i / 5, 6 * s); ctx.lineTo(w * i / 5, fmaH); ctx.stroke(); }
  [['SPEED', GREEN], ['ALT', GREEN], ['NAV', GREEN], ['', WHITE], ['AP1', WHITE]].forEach(([m, c], i) =>
    text(ctx, m, w * (i + 0.5) / 5, 24 * s, 21 * s, c));
  text(ctx, 'A/THR', w * 4.5 / 5, 52 * s, 21 * s, WHITE);

  // --- attitude indicator
  const cx = w * 0.47, cy = h * 0.47, aw = w * 0.46, ah = h * 0.50;
  const pitch = 2.5, roll = -6, ppd = 9 * s;   // px per degree
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - aw / 2, cy - ah / 2, aw, ah); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(roll * Math.PI / 180); ctx.translate(0, pitch * ppd);
  ctx.fillStyle = SKY; ctx.fillRect(-aw, -ah * 2, aw * 2, ah * 2);
  ctx.fillStyle = GROUND; ctx.fillRect(-aw, 0, aw * 2, ah * 2);
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.moveTo(-aw, 0); ctx.lineTo(aw, 0); ctx.stroke();
  for (let p = -20; p <= 20; p += 2.5) {
    if (p === 0) continue;
    const len = (p % 10 === 0 ? 70 : p % 5 === 0 ? 38 : 18) * s, y = -p * ppd;
    ctx.beginPath(); ctx.moveTo(-len / 2, y); ctx.lineTo(len / 2, y); ctx.stroke();
    if (p % 10 === 0) { text(ctx, String(Math.abs(p)), -len / 2 - 18 * s, y, 18 * s, WHITE); text(ctx, String(Math.abs(p)), len / 2 + 18 * s, y, 18 * s, WHITE); }
  }
  ctx.restore();
  // roll scale
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5 * s;
  const rr = ah * 0.62;
  ctx.beginPath(); ctx.arc(0, 0, rr, (-90 - 45) * Math.PI / 180, (-90 + 45) * Math.PI / 180); ctx.stroke();
  [-45, -30, -20, -10, 0, 10, 20, 30, 45].forEach(a => {
    const r2 = rr + (Math.abs(a) % 30 === 0 || a === 45 || a === -45 ? 16 : 9) * s, ar = (a - 90) * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(rr * Math.cos(ar), rr * Math.sin(ar)); ctx.lineTo(r2 * Math.cos(ar), r2 * Math.sin(ar)); ctx.stroke();
  });
  ctx.fillStyle = YELLOW; ctx.beginPath();
  ctx.moveTo(0, -rr + 2 * s); ctx.lineTo(-11 * s, -rr - 16 * s); ctx.lineTo(11 * s, -rr - 16 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
  // aircraft symbol + flight director
  ctx.fillStyle = '#000'; ctx.strokeStyle = YELLOW; ctx.lineWidth = 4 * s;
  [[-1], [1]].forEach(([d]) => {
    ctx.fillRect(cx + d * 52 * s - (d > 0 ? 0 : 70 * s), cy - 5 * s, 70 * s, 10 * s);
    ctx.strokeRect(cx + d * 52 * s - (d > 0 ? 0 : 70 * s), cy - 5 * s, 70 * s, 10 * s);
  });
  ctx.fillRect(cx - 6 * s, cy - 6 * s, 12 * s, 12 * s); ctx.strokeRect(cx - 6 * s, cy - 6 * s, 12 * s, 12 * s);
  ctx.strokeStyle = GREEN; ctx.lineWidth = 3.5 * s;
  ctx.beginPath(); ctx.moveTo(cx - 90 * s, cy + 6 * s); ctx.lineTo(cx + 90 * s, cy + 6 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 4 * s, cy - 80 * s); ctx.lineTo(cx + 4 * s, cy + 80 * s); ctx.stroke();

  // --- speed tape
  const tx = w * 0.035, tw = w * 0.13, ty = h * 0.20, th = h * 0.56, spd = 250;
  ctx.fillStyle = '#3b3e42'; ctx.fillRect(tx, ty, tw, th);
  ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2 * s;
  for (let v = spd - 60; v <= spd + 60; v += 10) {
    const y = ty + th / 2 - (v - spd) * 3.4 * s;
    ctx.beginPath(); ctx.moveTo(tx + tw - 14 * s, y); ctx.lineTo(tx + tw, y); ctx.stroke();
    if (v % 20 === 0) text(ctx, String(v), tx + tw - 22 * s, y, 21 * s, WHITE, 'right');
  }
  ctx.fillStyle = MAGENTA; ctx.beginPath(); const ys = ty + th / 2 - 10 * 3.4 * s;
  ctx.moveTo(tx + tw, ys); ctx.lineTo(tx + tw - 14 * s, ys - 9 * s); ctx.lineTo(tx + tw - 14 * s, ys + 9 * s); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(tx - 4 * s, ty + th / 2); ctx.lineTo(tx + tw + 12 * s, ty + th / 2); ctx.stroke();

  // --- altitude tape + readout
  const ax = w * 0.76, aw2 = w * 0.11, alt = 24000;
  ctx.fillStyle = '#3b3e42'; ctx.fillRect(ax, ty, aw2, th);
  ctx.save(); ctx.beginPath(); ctx.rect(ax, ty, aw2, th); ctx.clip();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2 * s;
  for (let a = alt - 1000; a <= alt + 1000; a += 100) {
    const y = ty + th / 2 - (a - alt) * 0.19 * s;
    ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax + (a % 500 === 0 ? 14 : 8) * s, y); ctx.stroke();
    if (a % 500 === 0) text(ctx, String(a / 100).padStart(3, '0'), ax + 20 * s, y, 21 * s, WHITE, 'left');
  }
  ctx.restore();
  ctx.fillStyle = '#000'; ctx.strokeStyle = YELLOW; ctx.lineWidth = 3 * s;
  ctx.fillRect(ax - 4 * s, ty + th / 2 - 20 * s, aw2 + 26 * s, 40 * s);
  ctx.strokeRect(ax - 4 * s, ty + th / 2 - 20 * s, aw2 + 26 * s, 40 * s);
  text(ctx, '240', ax + 6 * s, ty + th / 2, 26 * s, GREEN, 'left');
  text(ctx, '00', ax + 56 * s, ty + th / 2, 20 * s, GREEN, 'left');
  text(ctx, 'FL 240', ax + aw2 / 2, ty - 18 * s, 20 * s, CYAN);
  // vertical speed scale
  const vx = w * 0.915;
  ctx.fillStyle = '#3b3e42';
  ctx.beginPath(); ctx.moveTo(vx, ty + 20 * s); ctx.lineTo(vx + 34 * s, ty + 50 * s); ctx.lineTo(vx + 34 * s, ty + th - 50 * s);
  ctx.lineTo(vx, ty + th - 20 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = GREEN; ctx.lineWidth = 3.5 * s;
  ctx.beginPath(); ctx.moveTo(vx + 34 * s, ty + th / 2); ctx.lineTo(vx + 6 * s, ty + th / 2 - 4 * s); ctx.stroke();

  // --- heading tape
  const hx = w * 0.26, hw = w * 0.42, hy = h * 0.83, hh = h * 0.075, hdg = 87;
  ctx.fillStyle = '#3b3e42'; ctx.fillRect(hx, hy, hw, hh);
  ctx.save(); ctx.beginPath(); ctx.rect(hx, hy, hw, hh); ctx.clip();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2 * s;
  for (let d = Math.ceil((hdg - 30) / 5) * 5; d <= hdg + 30; d += 5) {
    const x = hx + hw / 2 + (d - hdg) * 7 * s;
    ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x, hy + (d % 10 === 0 ? 12 : 7) * s); ctx.stroke();
    if (d % 10 === 0) text(ctx, String(Math.round(((d % 360) + 360) % 360 / 10)).padStart(2, '0'), x, hy + 28 * s, 19 * s, WHITE);
  }
  ctx.restore();
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(hx + hw / 2, hy - 10 * s); ctx.lineTo(hx + hw / 2, hy + 16 * s); ctx.stroke();
  text(ctx, 'QNH 1013', ax + aw2 / 2, h * 0.86, 20 * s, CYAN);
  ctx.restore();
}

export function drawND(ctx, x0, y0, w, h) {
  ctx.save(); ctx.translate(x0, y0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const s = h / 668, cx = w / 2, cy = h * 0.86, R = h * 0.68, hdg = 87;
  // header data
  text(ctx, 'GS', 20 * s, 26 * s, 20 * s, WHITE, 'left'); text(ctx, '432', 58 * s, 26 * s, 22 * s, GREEN, 'left');
  text(ctx, 'TAS', 118 * s, 26 * s, 20 * s, WHITE, 'left'); text(ctx, '445', 166 * s, 26 * s, 22 * s, GREEN, 'left');
  text(ctx, '275/18', 20 * s, 54 * s, 20 * s, GREEN, 'left');
  text(ctx, 'VAKOR', w - 20 * s, 26 * s, 22 * s, WHITE, 'right');
  text(ctx, '091°', w - 20 * s, 52 * s, 20 * s, GREEN, 'right');
  text(ctx, '42 NM', w - 20 * s, 78 * s, 20 * s, GREEN, 'right');
  // compass arc
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5 * s;
  const a0 = -90 - 50, a1 = -90 + 50;
  ctx.beginPath(); ctx.arc(cx, cy, R, a0 * Math.PI / 180, a1 * Math.PI / 180); ctx.stroke();
  for (let d = Math.ceil((hdg - 50) / 5) * 5; d <= hdg + 50; d += 5) {
    const a = (d - hdg - 90) * Math.PI / 180, l = (d % 10 === 0 ? 18 : 10) * s;
    ctx.beginPath(); ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    ctx.lineTo(cx + (R + l) * Math.cos(a), cy + (R + l) * Math.sin(a)); ctx.stroke();
    if (d % 30 === 0) {
      ctx.save(); ctx.translate(cx + (R + 34 * s) * Math.cos(a), cy + (R + 34 * s) * Math.sin(a)); ctx.rotate(a + Math.PI / 2);
      text(ctx, String(((d % 360) + 360) % 360 / 10).padStart(2, '0'), 0, 0, 24 * s, WHITE); ctx.restore();
    }
  }
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(cx, cy - R - 24 * s); ctx.lineTo(cx, cy - R + 6 * s); ctx.stroke();
  // range rings
  ctx.setLineDash([10 * s, 10 * s]); ctx.strokeStyle = '#d0d0d0'; ctx.lineWidth = 1.5 * s;
  [0.5].forEach(f => { ctx.beginPath(); ctx.arc(cx, cy, R * f, a0 * Math.PI / 180, a1 * Math.PI / 180); ctx.stroke(); });
  ctx.setLineDash([]);
  text(ctx, '20', cx - R * 0.5 * 0.80, cy - R * 0.5 * 0.60, 18 * s, CYAN);
  text(ctx, '40', cx - R * 0.80, cy - R * 0.62, 18 * s, CYAN);
  // flight plan (green), next waypoint white
  const wpts = [[0, 0], [0.04, -0.42], [0.28, -0.78], [0.62, -1.02]];
  ctx.strokeStyle = GREEN; ctx.lineWidth = 3 * s; ctx.beginPath();
  wpts.forEach(([u, v], i) => { const X = cx + u * R, Y = cy + v * R; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();
  [['VAKOR', WHITE], ['TEMLI', GREEN], ['OSPAN', GREEN]].forEach(([n, c], i) => {
    const [u, v] = wpts[i + 1], X = cx + u * R, Y = cy + v * R, d = 9 * s;
    ctx.strokeStyle = c; ctx.lineWidth = 2.5 * s; ctx.beginPath();
    ctx.moveTo(X, Y - d); ctx.lineTo(X + d, Y); ctx.lineTo(X, Y + d); ctx.lineTo(X - d, Y); ctx.closePath(); ctx.stroke();
    text(ctx, n, X + 18 * s, Y, 20 * s, c, 'left');
  });
  // aircraft symbol
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 5 * s;
  ctx.beginPath(); ctx.moveTo(cx, cy - 26 * s); ctx.lineTo(cx, cy + 26 * s);
  ctx.moveTo(cx - 30 * s, cy - 6 * s); ctx.lineTo(cx + 30 * s, cy - 6 * s);
  ctx.moveTo(cx - 12 * s, cy + 20 * s); ctx.lineTo(cx + 12 * s, cy + 20 * s); ctx.stroke();
  text(ctx, 'VOR1', 20 * s, h - 46 * s, 20 * s, WHITE, 'left'); text(ctx, 'ABC', 20 * s, h - 20 * s, 20 * s, WHITE, 'left');
  ctx.restore();
}

// whole tablet screen. map = {pfd:[x0,y0,x1,y1], nd:[...]} in pixels (from info.json)
export function drawScreen(canvas, map, scale = 1) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const W = canvas.width / scale, H = canvas.height / scale;
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H);
  const [p0, , p1] = map.pfd, [n0, , n1] = map.nd;
  const top = Math.floor(map.pfd[1]) - 2, bot = Math.ceil(map.pfd[3]) + 2;
  drawPFD(ctx, 0, top, Math.ceil(p1) + 1, bot - top);
  drawND(ctx, Math.floor(n0) - 1, top, W - Math.floor(n0) + 1, bot - top);
  titleBar(ctx, 0, Math.ceil(p1), 'PFD - Pop-out');
  titleBar(ctx, Math.floor(n0), W - Math.floor(n0), 'ND - Pop-out');
  taskbar(ctx, W);
}
