/**
 * Amaze — interface layer. Owns the canvas, the controls and the animation
 * clock; every maze decision lives in engine.js.
 */
import {
  GENERATORS, SOLVERS, createGeneration, createSolve,
  braid, measure, distances, Rng, drain,
} from './engine.js';

const $ = (id) => document.getElementById(id);

/* ---- the distance ramp: oxidised bronze warming to gilt ------------ */

const RAMP_STOPS = [
  [0.00, [10, 29, 36]],
  [0.16, [16, 63, 76]],
  [0.32, [23, 107, 99]],
  [0.50, [61, 143, 90]],
  [0.66, [127, 168, 69]],
  [0.82, [201, 166, 60]],
  [0.92, [228, 185, 97]],
  [1.00, [246, 231, 194]],
];

const RAMP = (() => {
  const out = [];
  for (let k = 0; k < 256; k++) {
    const t = k / 255;
    let a = RAMP_STOPS[0], b = RAMP_STOPS[RAMP_STOPS.length - 1];
    for (let s = 0; s < RAMP_STOPS.length - 1; s++) {
      if (t >= RAMP_STOPS[s][0] && t <= RAMP_STOPS[s + 1][0]) { a = RAMP_STOPS[s]; b = RAMP_STOPS[s + 1]; break; }
    }
    const span = b[0] - a[0];
    const f = span > 0 ? (t - a[0]) / span : 0;
    const c = [0, 1, 2].map((n) => Math.round(a[1][n] + (b[1][n] - a[1][n]) * f));
    out.push(`rgb(${c[0]} ${c[1]} ${c[2]})`);
  }
  return out;
})();

const SPEEDS = [1, 2, 4, 10, 24, 60, 160, 500, Infinity];
const SPEED_LABELS = ['1 step', '2 steps', '4 steps', '10 steps', '24 steps', '60 steps', '160 steps', '500 steps', 'instant'];
const SEED_WORDS = ['minotaur', 'knossos', 'hedgerow', 'ariadne', 'cloister', 'warren', 'daedalus', 'thicket', 'catacomb', 'spiral', 'quarry', 'burrow'];

const state = {
  algorithm: 'backtracker',
  cols: 34,
  seedText: 'minotaur',
  braidAmount: 0,
  paint: 'distance',
  solver: 'longest',
  speed: 5,
  grid: null,
  pristine: null,
  gen: null,
  solve: null,
  metrics: null,
  dist: null,
  maxDist: 1,
  start: 0,
  goal: 0,
  hover: -1,
  running: false,
  geom: null,
};

const canvas = $('stage');
const g2d = canvas.getContext('2d');
let cssW = 0, cssH = 0;

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---- geometry ----------------------------------------------------- */

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = rect.width; cssH = rect.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  computeGeometry();
  render();
}

function computeGeometry() {
  if (!state.grid) return;
  const { w, h } = state.grid;
  const inset = 10;
  const cell = Math.max(2, Math.min((cssW - inset * 2) / w, (cssH - inset * 2) / h));
  state.geom = {
    cell,
    ox: (cssW - cell * w) / 2,
    oy: (cssH - cell * h) / 2,
    pad: Math.max(0.8, cell * 0.19),
  };
}

function rowsFor(cols) {
  const aspect = cssH && cssW ? cssH / cssW : 0.75;
  return Math.max(2, Math.round(cols * aspect));
}

function cellAt(clientX, clientY) {
  if (!state.geom || !state.grid) return -1;
  const rect = canvas.getBoundingClientRect();
  const { cell, ox, oy } = state.geom;
  const x = Math.floor((clientX - rect.left - ox) / cell);
  const y = Math.floor((clientY - rect.top - oy) / cell);
  return state.grid.inBounds(x, y) ? state.grid.idx(x, y) : -1;
}

/* ---- drawing ------------------------------------------------------ */

function render() {
  if (!state.grid || !state.geom) return;
  const g = state.grid;
  const { cell, ox, oy, pad } = state.geom;
  const plate = token('--plate');

  g2d.fillStyle = plate;
  g2d.fillRect(0, 0, cssW, cssH);

  const mid = cell - pad * 2;
  const generating = !!state.gen;
  const cellState = generating ? state.gen.ctx.state : null;
  const mode = generating ? 'passages' : state.paint;

  if (mode === 'walls') {
    drawWalls(g, cell, ox, oy);
  } else {
    drawCorridors(g, cell, ox, oy, pad, mid, mode, cellState);
  }

  if (generating) drawFrontier(g, cell, ox, oy, cellState, state.gen.ctx.head);
  if (state.solve) drawSolve(g, cell, ox, oy, pad, mid);

  if (state.hover >= 0) {
    g2d.strokeStyle = token('--accent');
    g2d.lineWidth = 1.5;
    g2d.strokeRect(ox + g.cx(state.hover) * cell + 0.75, oy + g.cy(state.hover) * cell + 0.75, cell - 1.5, cell - 1.5);
  }
}

/** Passages as filled corridors; the walls are the negative space between them. */
function drawCorridors(g, cell, ox, oy, pad, mid, mode, cellState) {
  const heat = mode === 'distance' && state.dist;
  const batches = new Map();
  const add = (key, x, y, w, h) => {
    let list = batches.get(key);
    if (!list) { list = []; batches.set(key, list); }
    list.push(x, y, w, h);
  };
  const shadeOf = (i) => {
    if (!heat) return 'ink';
    const d = state.dist[i];
    return d < 0 ? 'ink' : Math.round((d / state.maxDist) * 255);
  };

  for (let i = 0; i < g.size; i++) {
    if (cellState && cellState[i] === 0) continue;
    const x = ox + g.cx(i) * cell + pad;
    const y = oy + g.cy(i) * cell + pad;
    const ci = shadeOf(i);
    add(ci, x, y, mid, mid);

    if (g.linked(i, 4)) {                       // east
      const j = i + 1;
      if (!cellState || cellState[j] !== 0) {
        const cj = shadeOf(j);
        add(blend(ci, cj), x + mid, y, pad * 2, mid);
      }
    }
    if (g.linked(i, 2)) {                       // south
      const j = i + g.w;
      if (!cellState || cellState[j] !== 0) {
        const cj = shadeOf(j);
        add(blend(ci, cj), x, y + mid, mid, pad * 2);
      }
    }
  }

  const ink = token('--maze');
  for (const [key, rects] of batches) {
    g2d.fillStyle = key === 'ink' ? ink : RAMP[key];
    g2d.beginPath();
    for (let k = 0; k < rects.length; k += 4) g2d.rect(rects[k], rects[k + 1], rects[k + 2], rects[k + 3]);
    g2d.fill();
  }
}

function blend(a, b) {
  if (a === 'ink' || b === 'ink') return 'ink';
  return (a + b) >> 1;
}

/** The classic line drawing: stroke every wall that was never carved through. */
function drawWalls(g, cell, ox, oy) {
  g2d.strokeStyle = token('--maze');
  g2d.lineWidth = Math.max(1, Math.min(2.4, cell * 0.11));
  g2d.lineCap = 'square';
  g2d.beginPath();
  for (let i = 0; i < g.size; i++) {
    const x = ox + g.cx(i) * cell;
    const y = oy + g.cy(i) * cell;
    if (!g.linked(i, 1)) { g2d.moveTo(x, y); g2d.lineTo(x + cell, y); }
    if (!g.linked(i, 8)) { g2d.moveTo(x, y); g2d.lineTo(x, y + cell); }
    if (g.cx(i) === g.w - 1) { g2d.moveTo(x + cell, y); g2d.lineTo(x + cell, y + cell); }
    if (g.cy(i) === g.h - 1) { g2d.moveTo(x, y + cell); g2d.lineTo(x + cell, y + cell); }
  }
  g2d.stroke();
}

function drawFrontier(g, cell, ox, oy, cellState, head) {
  g2d.fillStyle = token('--accent-soft');
  g2d.beginPath();
  for (let i = 0; i < g.size; i++) {
    if (cellState[i] !== 2) continue;
    g2d.rect(ox + g.cx(i) * cell, oy + g.cy(i) * cell, cell, cell);
  }
  g2d.fill();
  if (head >= 0) {
    g2d.fillStyle = token('--path');
    g2d.fillRect(ox + g.cx(head) * cell, oy + g.cy(head) * cell, cell, cell);
  }
}

function drawSolve(g, cell, ox, oy, pad, mid) {
  const { ctx } = state.solve;

  g2d.fillStyle = token('--accent-soft');
  g2d.beginPath();
  for (let i = 0; i < g.size; i++) {
    if (!ctx.seen[i]) continue;
    g2d.rect(ox + g.cx(i) * cell + pad, oy + g.cy(i) * cell + pad, mid, mid);
  }
  g2d.fill();

  const path = ctx.path;
  if (path && path.length) {
    g2d.strokeStyle = token('--path');
    g2d.lineWidth = Math.max(1.6, cell * 0.34);
    g2d.lineJoin = 'round';
    g2d.lineCap = 'round';
    g2d.beginPath();
    for (let k = 0; k < path.length; k++) {
      const px = ox + g.cx(path[k]) * cell + cell / 2;
      const py = oy + g.cy(path[k]) * cell + cell / 2;
      if (k === 0) g2d.moveTo(px, py); else g2d.lineTo(px, py);
    }
    g2d.stroke();
    marker(g, path[0], cell, ox, oy, true);
    marker(g, path[path.length - 1], cell, ox, oy, false);
  }
}

function marker(g, i, cell, ox, oy, filled) {
  const cx = ox + g.cx(i) * cell + cell / 2;
  const cy = oy + g.cy(i) * cell + cell / 2;
  const r = Math.max(2.5, cell * 0.3);
  g2d.lineWidth = Math.max(1.2, cell * 0.12);
  g2d.beginPath();
  g2d.arc(cx, cy, r, 0, Math.PI * 2);
  g2d.fillStyle = filled ? token('--path') : token('--plate');
  g2d.fill();
  g2d.strokeStyle = filled ? token('--plate') : token('--path');
  g2d.stroke();
}

/* ---- run loop ------------------------------------------------------ */

function tick() {
  if (!state.running) return;
  const budget = SPEEDS[state.speed];

  if (state.gen) {
    if (budget === Infinity) {
      drain(state.gen.iter);
      finishGeneration();
    } else {
      for (let k = 0; k < budget; k++) {
        if (state.gen.iter.next().done) { finishGeneration(); break; }
      }
    }
  } else if (state.solve) {
    if (budget === Infinity) {
      drain(state.solve.iter);
      finishSolve();
    } else {
      for (let k = 0; k < budget; k++) {
        if (state.solve.iter.next().done) { finishSolve(); break; }
      }
    }
  } else {
    state.running = false;
  }

  render();
  updateReadouts();
  if (state.running) requestAnimationFrame(tick);
}

function start() {
  if (state.running) return;
  state.running = true;
  requestAnimationFrame(tick);
}

/* ---- actions ------------------------------------------------------- */

function carve(instant) {
  const rows = rowsFor(state.cols);
  state.gen = createGeneration(state.algorithm, state.cols, rows, state.seedText);
  state.grid = state.gen.grid;
  state.pristine = null;
  state.solve = null;
  state.dist = null;
  state.start = 0;
  state.goal = state.grid.size - 1;
  state.hover = -1;
  computeGeometry();
  syncCaption();

  if (instant || SPEEDS[state.speed] === Infinity) {
    drain(state.gen.iter);
    finishGeneration();
    render();
    updateReadouts();
  } else {
    start();
  }
}

function finishGeneration() {
  state.pristine = state.grid.clone();
  state.gen = null;
  state.running = false;
  applyBraid();
}

/** Braiding is re-derived from the pristine maze so the slider runs both ways. */
function applyBraid() {
  if (!state.pristine) return;
  state.grid = state.pristine.clone();
  if (state.braidAmount > 0) braid(state.grid, new Rng(state.seedText + ':braid'), state.braidAmount);
  state.solve = null;
  recomputeField();
  render();
  updateReadouts();
}

function recomputeField() {
  if (!state.grid || state.gen) return;
  state.metrics = measure(state.grid);
  state.dist = distances(state.grid, state.start);
  let max = 1;
  for (let i = 0; i < state.dist.length; i++) if (state.dist[i] > max) max = state.dist[i];
  state.maxDist = max;
}

function trace(instant) {
  if (!state.grid || state.gen) return;
  state.solve = createSolve(state.solver, state.grid, state.start, state.goal);
  if (instant || SPEEDS[state.speed] === Infinity) {
    drain(state.solve.iter);
    finishSolve();
    render();
    updateReadouts();
  } else {
    start();
  }
}

function finishSolve() {
  state.running = false;
}

/* ---- readouts ------------------------------------------------------ */

const pct = (v) => `${(v * 100).toFixed(1)}%`;

function updateReadouts() {
  const m = state.metrics;
  const g = state.grid;
  if (!g) return;

  $('chip-dim').textContent = `${g.w} × ${g.h}`;
  $('chip-seed').textContent = state.seedText || '—';
  $('chip-algo').textContent = GENERATORS[state.algorithm].label;

  if (state.gen) {
    let carved = 0;
    for (let i = 0; i < g.size; i++) if (state.gen.ctx.state[i] === 1) carved++;
    $('r-cells').textContent = carved.toLocaleString();
    $('r-passages').textContent = pct(carved / g.size);
    return;
  }
  if (!m) return;

  $('r-cells').textContent = m.cells.toLocaleString();
  $('r-passages').textContent = m.passages.toLocaleString();
  $('r-dead').textContent = m.deadEnds.toLocaleString();
  $('r-junctions').textContent = m.junctions.toLocaleString();
  $('r-loops').textContent = m.loops.toLocaleString();
  $('r-diameter').textContent = m.diameter.toLocaleString();

  const path = state.solve && state.solve.ctx.path;
  $('r-route').innerHTML = path && path.length
    ? `${path.length - 1}<small> steps</small>`
    : '<small>not traced</small>';

  let opened = 0;
  if (state.solve) for (let i = 0; i < state.solve.ctx.seen.length; i++) if (state.solve.ctx.seen[i] === 1) opened++;
  $('r-opened').innerHTML = state.solve ? `${pct(opened / m.cells)}` : '<small>—</small>';

  meter('dead', m.deadEndRatio, 0.45, pct(m.deadEndRatio));
  meter('twist', m.twistiness, 1, pct(m.twistiness));
  bipolar('grain', m.grain, m.grain === 0 ? 'even' : `${m.grain > 0 ? 'E–W' : 'N–S'} ${pct(Math.abs(m.grain))}`);
}

function meter(id, value, scale, label) {
  $(`m-${id}`).textContent = label;
  $(`b-${id}`).style.width = `${Math.min(100, (value / scale) * 100)}%`;
}

function bipolar(id, value, label) {
  $(`m-${id}`).textContent = label;
  const bar = $(`b-${id}`);
  const half = Math.min(50, Math.abs(value) * 50);
  bar.style.left = value >= 0 ? '50%' : `${50 - half}%`;
  bar.style.width = `${half}%`;
}

function syncCaption() {
  const g = state.grid;
  $('caption').innerHTML =
    `Fig. 1 — <b>${GENERATORS[state.algorithm].label}</b>, ${g.w} × ${g.h} cells, seed “${state.seedText}”.`;
  $('note-algo').textContent = GENERATORS[state.algorithm].note;
  $('note-solver').textContent = SOLVERS[state.solver].note;
}

/* ---- wiring -------------------------------------------------------- */

function buildOptions() {
  $('algorithm').innerHTML = Object.entries(GENERATORS)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('solver').innerHTML = Object.entries(SOLVERS)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('algorithm').value = state.algorithm;
  $('solver').value = state.solver;
}

function wire() {
  $('algorithm').addEventListener('change', (e) => {
    state.algorithm = e.target.value;
    $('note-algo').textContent = GENERATORS[state.algorithm].note;
    carve(false);
  });

  $('cols').addEventListener('input', (e) => {
    state.cols = +e.target.value;
    $('cols-value').textContent = `${state.cols} × ${rowsFor(state.cols)}`;
  });
  $('cols').addEventListener('change', () => carve(true));

  $('seed').addEventListener('change', (e) => {
    state.seedText = e.target.value.trim() || 'minotaur';
    e.target.value = state.seedText;
    carve(true);
  });

  $('reroll').addEventListener('click', () => {
    const word = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
    state.seedText = `${word}-${Math.floor(Math.random() * 900 + 100)}`;
    $('seed').value = state.seedText;
    carve(false);
  });

  $('speed').addEventListener('input', (e) => {
    state.speed = +e.target.value;
    $('speed-value').textContent = SPEED_LABELS[state.speed];
  });

  $('braid').addEventListener('input', (e) => {
    state.braidAmount = +e.target.value / 100;
    $('braid-value').textContent = e.target.value === '0' ? 'none' : `${e.target.value}%`;
  });
  $('braid').addEventListener('change', applyBraid);

  for (const btn of document.querySelectorAll('.segmented button')) {
    btn.addEventListener('click', () => {
      state.paint = btn.dataset.paint;
      for (const other of document.querySelectorAll('.segmented button')) {
        other.setAttribute('aria-pressed', String(other === btn));
      }
      render();
    });
  }

  $('solver').addEventListener('change', (e) => {
    state.solver = e.target.value;
    $('note-solver').textContent = SOLVERS[state.solver].note;
    trace(false);
  });

  $('carve').addEventListener('click', () => carve(false));
  $('trace').addEventListener('click', () => trace(false));

  canvas.addEventListener('mousemove', (e) => {
    const i = cellAt(e.clientX, e.clientY);
    if (i === state.hover) return;
    state.hover = i;
    probe(i);
    render();
  });
  canvas.addEventListener('mouseleave', () => { state.hover = -1; probe(-1); render(); });

  canvas.addEventListener('click', (e) => {
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || state.gen) return;
    if (e.shiftKey) state.goal = i; else state.start = i;
    recomputeField();
    state.solve = null;
    render();
    updateReadouts();
    probe(i);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'g' || e.key === 'G') { carve(false); e.preventDefault(); }
    if (e.key === 't' || e.key === 'T') { trace(false); e.preventDefault(); }
    if (e.key === 'r' || e.key === 'R') { $('reroll').click(); e.preventDefault(); }
  });

  const ro = new ResizeObserver(() => {
    const before = state.grid ? state.grid.h : 0;
    resize();
    if (state.grid && rowsFor(state.cols) !== before) $('cols-value').textContent = `${state.cols} × ${state.grid.h}`;
  });
  ro.observe(canvas.parentElement);
}

function probe(i) {
  const el = $('probe');
  if (i < 0 || !state.grid) { el.textContent = ''; return; }
  const g = state.grid;
  const d = state.dist ? state.dist[i] : -1;
  const roles = [];
  if (i === state.start) roles.push('start');
  if (i === state.goal) roles.push('goal');
  el.textContent = `x ${g.cx(i)}  y ${g.cy(i)}   d ${d < 0 ? '∞' : d}` + (roles.length ? `   ${roles.join(' · ')}` : '');
}

function boot() {
  buildOptions();
  wire();
  $('cols').value = state.cols;
  $('speed').value = state.speed;
  $('speed-value').textContent = SPEED_LABELS[state.speed];
  $('seed').value = state.seedText;
  resize();
  $('cols-value').textContent = `${state.cols} × ${rowsFor(state.cols)}`;
  // Open on a finished plate rather than an empty frame.
  carve(true);
  trace(true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
