/**
 * Amaze — maze engine.
 *
 * Pure logic: no DOM, no globals. Everything is deterministic given a seed,
 * so a figure can be reproduced exactly from its caption.
 *
 * A maze is a Grid of cells; each cell holds a bitmask of the directions in
 * which a passage has been carved. Generators and solvers are generator
 * functions that yield once per elementary step, which is what makes the
 * animation possible without any scheduling logic inside the algorithms.
 */

export const N = 1, S = 2, E = 4, W = 8;
export const DIRS = [N, S, E, W];

const DX = { 1: 0, 2: 0, 4: 1, 8: -1 };
const DY = { 1: -1, 2: 1, 4: 0, 8: 0 };
const OPP = { 1: S, 2: N, 4: W, 8: E };

/** Popcount for a 4-bit mask. */
const POP = new Uint8Array(16);
for (let i = 0; i < 16; i++) POP[i] = (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1);

/* ------------------------------------------------------------------ *
 * Randomness
 * ------------------------------------------------------------------ */

export function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 0x9e3779b9;
}

export class Rng {
  constructor(seed) {
    this.s = typeof seed === 'number' ? (seed >>> 0) || 1 : hashSeed(seed);
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}

/* ------------------------------------------------------------------ *
 * Grid
 * ------------------------------------------------------------------ */

export class Grid {
  constructor(w, h) {
    this.w = w; this.h = h; this.size = w * h;
    this.cells = new Uint8Array(this.size);
  }
  idx(x, y) { return y * this.w + x; }
  cx(i) { return i % this.w; }
  cy(i) { return (i / this.w) | 0; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Index of the neighbour in direction `d`, or -1 at the border. */
  neighbor(i, d) {
    const x = (i % this.w) + DX[d];
    const y = ((i / this.w) | 0) + DY[d];
    return this.inBounds(x, y) ? y * this.w + x : -1;
  }
  link(i, d) {
    const j = this.neighbor(i, d);
    if (j < 0) return -1;
    this.cells[i] |= d; this.cells[j] |= OPP[d];
    return j;
  }
  unlink(i, d) {
    const j = this.neighbor(i, d);
    if (j < 0) return -1;
    this.cells[i] &= ~d; this.cells[j] &= ~OPP[d];
    return j;
  }
  linked(i, d) { return (this.cells[i] & d) !== 0; }
  degree(i) { return POP[this.cells[i]]; }
  openAll() {
    for (let i = 0; i < this.size; i++) {
      for (const d of DIRS) if (this.neighbor(i, d) >= 0) this.cells[i] |= d;
    }
  }
  clone() {
    const g = new Grid(this.w, this.h);
    g.cells.set(this.cells);
    return g;
  }
}

/* ------------------------------------------------------------------ *
 * Generators
 *
 * Every generator takes (grid, rng, ctx) where ctx carries the visual state:
 *   ctx.state[i]  0 = untouched, 1 = carved into the maze, 2 = on the frontier
 *   ctx.head      the cell the algorithm is currently working on, or -1
 * ------------------------------------------------------------------ */

function* recursiveBacktracker(g, rng, ctx) {
  const start = rng.int(g.size);
  const stack = [start];
  ctx.state[start] = 1;
  while (stack.length) {
    const i = stack[stack.length - 1];
    ctx.head = i;
    const opts = [];
    for (const d of DIRS) {
      const j = g.neighbor(i, d);
      if (j >= 0 && ctx.state[j] === 0) opts.push(d);
    }
    if (!opts.length) { stack.pop(); yield; continue; }
    const j = g.link(i, rng.pick(opts));
    ctx.state[j] = 1;
    stack.push(j);
    yield;
  }
}

function* huntAndKill(g, rng, ctx) {
  let i = rng.int(g.size);
  ctx.state[i] = 1;
  while (i >= 0) {
    ctx.head = i;
    const opts = [];
    for (const d of DIRS) {
      const j = g.neighbor(i, d);
      if (j >= 0 && ctx.state[j] === 0) opts.push(d);
    }
    if (opts.length) {
      const j = g.link(i, rng.pick(opts));
      ctx.state[j] = 1;
      i = j;
      yield;
      continue;
    }
    // Hunt: scan in reading order for an untouched cell beside the maze.
    i = -1;
    outer:
    for (let k = 0; k < g.size; k++) {
      if (ctx.state[k] !== 0) continue;
      const carved = [];
      for (const d of DIRS) {
        const j = g.neighbor(k, d);
        if (j >= 0 && ctx.state[j] === 1) carved.push(d);
      }
      if (carved.length) {
        g.link(k, rng.pick(carved));
        ctx.state[k] = 1;
        i = k;
        yield;
        break outer;
      }
    }
  }
}

function* primSimplified(g, rng, ctx) {
  const start = rng.int(g.size);
  ctx.state[start] = 1;
  const frontier = [];
  const queued = new Uint8Array(g.size);
  const push = (i) => {
    for (const d of DIRS) {
      const j = g.neighbor(i, d);
      if (j >= 0 && ctx.state[j] === 0 && !queued[j]) {
        queued[j] = 1; ctx.state[j] = 2; frontier.push(j);
      }
    }
  };
  push(start);
  while (frontier.length) {
    const k = rng.int(frontier.length);
    const c = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    const carved = [];
    for (const d of DIRS) {
      const j = g.neighbor(c, d);
      if (j >= 0 && ctx.state[j] === 1) carved.push(d);
    }
    g.link(c, rng.pick(carved));
    ctx.state[c] = 1;
    ctx.head = c;
    push(c);
    yield;
  }
}

function* kruskal(g, rng, ctx) {
  const parent = new Int32Array(g.size);
  for (let i = 0; i < g.size; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };

  const edges = [];
  for (let i = 0; i < g.size; i++) {
    for (const d of [E, S]) if (g.neighbor(i, d) >= 0) edges.push(i * 4 + (d === E ? 0 : 1));
  }
  rng.shuffle(edges);
  for (const e of edges) {
    const i = (e / 4) | 0;
    const d = e % 4 === 0 ? E : S;
    const j = g.neighbor(i, d);
    const a = find(i), b = find(j);
    if (a === b) continue;
    parent[a] = b;
    g.link(i, d);
    ctx.state[i] = 1; ctx.state[j] = 1; ctx.head = j;
    yield;
  }
}

function* wilson(g, rng, ctx) {
  const remaining = [];
  for (let i = 0; i < g.size; i++) remaining.push(i);
  rng.shuffle(remaining);
  const root = remaining.pop();
  ctx.state[root] = 1;

  const stepDir = new Uint8Array(g.size);
  while (remaining.length) {
    let c = remaining[remaining.length - 1];
    if (ctx.state[c] === 1) { remaining.pop(); continue; }

    // Random walk until it meets the tree, erasing its own loops as it goes.
    const touched = [];
    let cur = c;
    while (ctx.state[cur] !== 1) {
      if (ctx.state[cur] === 0) { ctx.state[cur] = 2; touched.push(cur); }
      let j = -1, d = 0;
      do { d = DIRS[rng.int(4)]; j = g.neighbor(cur, d); } while (j < 0);
      stepDir[cur] = d;
      cur = j;
      ctx.head = cur;
      yield;
    }
    // Carve the loop-erased path: following stepDir from c skips every loop.
    cur = c;
    while (ctx.state[cur] !== 1) {
      const d = stepDir[cur];
      const j = g.link(cur, d);
      ctx.state[cur] = 1;
      cur = j;
    }
    for (const t of touched) if (ctx.state[t] === 2) ctx.state[t] = 0;
    yield;
  }
}

function* eller(g, rng, ctx) {
  const setOf = new Int32Array(g.size).fill(-1);
  let nextSet = 0;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = g.idx(x, y);
      if (setOf[i] < 0) setOf[i] = nextSet++;
      ctx.state[i] = 1;
    }
    const lastRow = y === g.h - 1;
    for (let x = 0; x < g.w - 1; x++) {
      const i = g.idx(x, y), j = g.idx(x + 1, y);
      if (setOf[i] === setOf[j]) continue;
      if (!lastRow && rng.next() >= 0.5) continue;
      const from = setOf[j], to = setOf[i];
      for (let k = 0; k < g.size; k++) if (setOf[k] === from) setOf[k] = to;
      g.link(i, E);
      ctx.head = j;
      yield;
    }
    if (lastRow) break;

    const groups = new Map();
    for (let x = 0; x < g.w; x++) {
      const i = g.idx(x, y);
      let m = groups.get(setOf[i]);
      if (!m) { m = []; groups.set(setOf[i], m); }
      m.push(i);
    }
    for (const [s, members] of groups) {
      rng.shuffle(members);
      for (let k = 0; k < members.length; k++) {
        if (k > 0 && rng.next() >= 0.5) continue;
        const j = g.link(members[k], S);
        setOf[j] = s;
        ctx.state[j] = 1;
        ctx.head = j;
        yield;
      }
    }
  }
}

function* recursiveDivision(g, rng, ctx) {
  g.openAll();
  ctx.state.fill(1);
  yield* divide(g, rng, ctx, 0, 0, g.w, g.h);
}

function* divide(g, rng, ctx, x, y, w, h) {
  if (w < 2 || h < 2) return;
  const horizontal = h > w ? true : w > h ? false : rng.int(2) === 0;
  if (horizontal) {
    const wallY = y + rng.int(h - 1);
    const gap = x + rng.int(w);
    for (let i = x; i < x + w; i++) {
      if (i !== gap) g.unlink(g.idx(i, wallY), S);
    }
    ctx.head = g.idx(gap, wallY);
    yield;
    const top = wallY - y + 1;
    yield* divide(g, rng, ctx, x, y, w, top);
    yield* divide(g, rng, ctx, x, wallY + 1, w, h - top);
  } else {
    const wallX = x + rng.int(w - 1);
    const gap = y + rng.int(h);
    for (let j = y; j < y + h; j++) {
      if (j !== gap) g.unlink(g.idx(wallX, j), E);
    }
    ctx.head = g.idx(wallX, gap);
    yield;
    const left = wallX - x + 1;
    yield* divide(g, rng, ctx, x, y, left, h);
    yield* divide(g, rng, ctx, wallX + 1, y, w - left, h);
  }
}

function* binaryTree(g, rng, ctx) {
  for (let i = 0; i < g.size; i++) {
    const opts = [];
    if (g.neighbor(i, N) >= 0) opts.push(N);
    if (g.neighbor(i, E) >= 0) opts.push(E);
    ctx.state[i] = 1;
    ctx.head = i;
    if (opts.length) g.link(i, rng.pick(opts));
    yield;
  }
}

function* sidewinder(g, rng, ctx) {
  for (let y = 0; y < g.h; y++) {
    let run = [];
    for (let x = 0; x < g.w; x++) {
      const i = g.idx(x, y);
      run.push(i);
      ctx.state[i] = 1;
      ctx.head = i;
      const atEast = x === g.w - 1;
      const closeOut = atEast || (y > 0 && rng.next() < 0.5);
      if (closeOut) {
        if (y > 0) g.link(rng.pick(run), N);
        run = [];
      } else {
        g.link(i, E);
      }
      yield;
    }
  }
}

export const GENERATORS = {
  backtracker: {
    label: 'Recursive backtracker',
    fn: recursiveBacktracker,
    note: 'A depth-first walk that only retreats when cornered. Long, sinuous corridors and very few junctions — the most “river-like” of the nine.',
  },
  prim: {
    label: "Prim's (simplified)",
    fn: primSimplified,
    note: 'Grows outward from a seed cell, always attaching a random frontier cell. Short, stubby passages radiating from the origin; dead ends everywhere.',
  },
  kruskal: {
    label: "Kruskal's",
    fn: kruskal,
    note: 'Shuffles every wall, then knocks down any that joins two separate regions. Uniform, isotropic texture with no sense of origin.',
  },
  wilson: {
    label: "Wilson's",
    fn: wilson,
    note: 'Loop-erased random walks. Slow to start and glacial at large sizes, but the only method here that draws every possible maze with equal probability.',
  },
  eller: {
    label: "Eller's",
    fn: eller,
    note: 'Works one row at a time, tracking which cells already connect. Needs memory for a single row, so it can generate an infinitely tall maze.',
  },
  huntkill: {
    label: 'Hunt-and-kill',
    fn: huntAndKill,
    note: 'A backtracker with no stack: when cornered it scans the grid for a fresh cell touching the maze. Long corridors, plus a faint top-to-bottom grain from the scan order.',
  },
  division: {
    label: 'Recursive division',
    fn: recursiveDivision,
    note: 'The only subtractive method here — it starts with an open field and keeps bisecting it, leaving one gap per wall. Produces distinct rectangular rooms.',
  },
  sidewinder: {
    label: 'Sidewinder',
    fn: sidewinder,
    note: 'Carves eastward runs, then punches one passage north per run. The top row is a single unbroken corridor — a permanent tell.',
  },
  binary: {
    label: 'Binary tree',
    fn: binaryTree,
    note: 'Each cell flips a coin: carve north or east. Two full corridors along the north and east edges, and a diagonal grain across the whole field.',
  },
};

/* ------------------------------------------------------------------ *
 * Braiding — remove dead ends by linking them onward, creating loops.
 * ------------------------------------------------------------------ */

export function braid(g, rng, amount) {
  if (amount <= 0) return;
  const deadEnds = [];
  for (let i = 0; i < g.size; i++) if (g.degree(i) === 1) deadEnds.push(i);
  rng.shuffle(deadEnds);
  for (const i of deadEnds) {
    if (g.degree(i) !== 1) continue;
    if (rng.next() > amount) continue;
    const closed = DIRS.filter((d) => g.neighbor(i, d) >= 0 && !g.linked(i, d));
    if (!closed.length) continue;
    // Prefer joining two dead ends: it removes two at once and reads better.
    const best = closed.filter((d) => g.degree(g.neighbor(i, d)) === 1);
    g.link(i, rng.pick(best.length ? best : closed));
  }
}

/* ------------------------------------------------------------------ *
 * Analysis
 * ------------------------------------------------------------------ */

/** Breadth-first distances from `source`; -1 where unreachable. */
export function distances(g, source) {
  const dist = new Int32Array(g.size).fill(-1);
  const queue = new Int32Array(g.size);
  let head = 0, tail = 0;
  dist[source] = 0;
  queue[tail++] = source;
  while (head < tail) {
    const i = queue[head++];
    for (const d of DIRS) {
      if (!g.linked(i, d)) continue;
      const j = g.neighbor(i, d);
      if (j < 0 || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

function farthest(dist) {
  let best = 0, at = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > best) { best = dist[i]; at = i; }
  return { cell: at, d: best };
}

/** Longest shortest-path in the maze (exact for trees, a lower bound once braided). */
export function diameter(g) {
  const a = farthest(distances(g, 0)).cell;
  const da = distances(g, a);
  const b = farthest(da);
  return { from: a, to: b.cell, length: b.d };
}

export function measure(g) {
  let deadEnds = 0, junctions = 0, straights = 0, turns = 0, passages = 0;
  let horizontal = 0, vertical = 0;
  for (let i = 0; i < g.size; i++) {
    const c = g.cells[i], deg = POP[c];
    if (c & E) { passages++; horizontal++; }
    if (c & S) { passages++; vertical++; }
    if (deg === 1) deadEnds++;
    else if (deg >= 3) junctions++;
    else if (deg === 2) {
      if (c === (N | S) || c === (E | W)) straights++; else turns++;
    }
  }
  const corridor = straights + turns;
  const dia = diameter(g);
  return {
    cells: g.size,
    passages,
    deadEnds,
    deadEndRatio: deadEnds / g.size,
    junctions,
    junctionRatio: junctions / g.size,
    twistiness: corridor ? turns / corridor : 0,
    // -1 = every passage runs north-south, +1 = every passage runs east-west.
    grain: passages ? (horizontal - vertical) / passages : 0,
    loops: passages - (g.size - 1),
    diameter: dia.length,
    diameterFrom: dia.from,
    diameterTo: dia.to,
    reach: dia.length / g.size,
  };
}

/* ------------------------------------------------------------------ *
 * Solvers
 *
 * Same contract as the generators: yield once per step, and leave the result
 * on ctx.path. ctx.seen[i] is 0 unvisited, 1 expanded, 2 on the fringe.
 * ------------------------------------------------------------------ */

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    this.k.push(key); this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= this.k[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop() {
    const top = this.v[0];
    const lk = this.k.pop(), lv = this.v.pop();
    if (this.k.length) {
      this.k[0] = lk; this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.k.length && this.k[l] < this.k[m]) m = l;
        if (r < this.k.length && this.k[r] < this.k[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  swap(a, b) {
    const tk = this.k[a]; this.k[a] = this.k[b]; this.k[b] = tk;
    const tv = this.v[a]; this.v[a] = this.v[b]; this.v[b] = tv;
  }
}

function tracePath(prev, start, goal) {
  const path = [];
  let c = goal;
  while (c !== -1 && c !== start) { path.push(c); c = prev[c]; }
  if (c !== start) return [];
  path.push(start);
  return path.reverse();
}

function* breadthFirst(g, ctx, start, goal) {
  const prev = new Int32Array(g.size).fill(-1);
  const queue = [start];
  let qi = 0;
  ctx.seen[start] = 1;
  while (qi < queue.length) {
    const i = queue[qi++];
    ctx.seen[i] = 1;
    ctx.head = i;
    if (i === goal) break;
    for (const d of DIRS) {
      if (!g.linked(i, d)) continue;
      const j = g.neighbor(i, d);
      if (j < 0 || ctx.seen[j]) continue;
      ctx.seen[j] = 2; prev[j] = i; queue.push(j);
    }
    yield;
  }
  ctx.path = tracePath(prev, start, goal);
}

function* aStar(g, ctx, start, goal) {
  const gx = g.cx(goal), gy = g.cy(goal);
  const heuristic = (i) => Math.abs(g.cx(i) - gx) + Math.abs(g.cy(i) - gy);
  const cost = new Int32Array(g.size).fill(0x7fffffff);
  const prev = new Int32Array(g.size).fill(-1);
  const open = new MinHeap();
  cost[start] = 0;
  open.push(heuristic(start), start);
  ctx.seen[start] = 2;
  while (open.size) {
    const i = open.pop();
    if (ctx.seen[i] === 1) continue;
    ctx.seen[i] = 1;
    ctx.head = i;
    if (i === goal) break;
    for (const d of DIRS) {
      if (!g.linked(i, d)) continue;
      const j = g.neighbor(i, d);
      if (j < 0) continue;
      const next = cost[i] + 1;
      if (next >= cost[j]) continue;
      cost[j] = next; prev[j] = i;
      if (ctx.seen[j] !== 1) ctx.seen[j] = 2;
      open.push(next + heuristic(j), j);
    }
    yield;
  }
  ctx.path = tracePath(prev, start, goal);
}

/** Left-hand rule. Never shortest, but it needs no memory of where it has been. */
function* wallFollower(g, ctx, start, goal) {
  const order = [N, E, S, W];
  let facing = 0;
  for (let k = 0; k < 4; k++) if (g.linked(start, order[k])) { facing = k; break; }
  const trail = [start];
  const onTrail = new Int32Array(g.size).fill(-1);
  onTrail[start] = 0;
  let cur = start;
  const cap = g.size * 12;
  for (let step = 0; step < cap && cur !== goal; step++) {
    const left = (facing + 3) % 4;
    let move = -1;
    if (g.linked(cur, order[left])) { facing = left; move = left; }
    else if (g.linked(cur, order[facing])) move = facing;
    else {
      const right = (facing + 1) % 4;
      if (g.linked(cur, order[right])) { facing = right; move = right; }
      else { facing = (facing + 2) % 4; move = facing; }
    }
    cur = g.neighbor(cur, order[move]);
    ctx.seen[cur] = 1;
    ctx.head = cur;
    // Cut the loop out of the trail whenever the walk crosses itself.
    if (onTrail[cur] >= 0) {
      for (let k = trail.length - 1; k > onTrail[cur]; k--) onTrail[trail[k]] = -1;
      trail.length = onTrail[cur] + 1;
    } else {
      onTrail[cur] = trail.length;
      trail.push(cur);
    }
    yield;
  }
  ctx.path = cur === goal ? trail.slice() : [];
}

/** Fill every dead end until only the corridors between start and goal survive. */
function* deadEndFill(g, ctx, start, goal) {
  const filled = new Uint8Array(g.size);
  let queue = [];
  for (let i = 0; i < g.size; i++) if (g.degree(i) === 1 && i !== start && i !== goal) queue.push(i);
  while (queue.length) {
    const next = [];
    for (const i of queue) {
      if (filled[i] || i === start || i === goal) continue;
      let open = 0, onlyDir = 0;
      for (const d of DIRS) {
        if (!g.linked(i, d)) continue;
        const j = g.neighbor(i, d);
        if (j >= 0 && !filled[j]) { open++; onlyDir = d; }
      }
      if (open > 1) continue;
      filled[i] = 1;
      ctx.seen[i] = 1;
      ctx.head = i;
      if (open === 1) next.push(g.neighbor(i, onlyDir));
      yield;
    }
    queue = next;
  }
  // What is left is the solution corridor; walk it to order the cells.
  const prev = new Int32Array(g.size).fill(-1);
  const seen = new Uint8Array(g.size);
  const q = [start]; let qi = 0; seen[start] = 1;
  while (qi < q.length) {
    const i = q[qi++];
    if (i === goal) break;
    for (const d of DIRS) {
      if (!g.linked(i, d)) continue;
      const j = g.neighbor(i, d);
      if (j < 0 || seen[j] || filled[j]) continue;
      seen[j] = 1; prev[j] = i; q.push(j);
    }
  }
  ctx.path = tracePath(prev, start, goal);
}

/** Not a search: the two ends of the maze's longest corridor. */
function* longestPath(g, ctx) {
  const { from, to } = diameter(g);
  const prev = new Int32Array(g.size).fill(-1);
  const q = [from];
  let qi = 0;
  ctx.seen[from] = 1;
  while (qi < q.length) {
    const i = q[qi++];
    ctx.head = i;
    for (const d of DIRS) {
      if (!g.linked(i, d)) continue;
      const j = g.neighbor(i, d);
      if (j < 0 || ctx.seen[j]) continue;
      ctx.seen[j] = 1; prev[j] = i; q.push(j);
    }
    yield;
  }
  ctx.path = tracePath(prev, from, to);
  ctx.endpoints = [from, to];
}

export const SOLVERS = {
  bfs: { label: 'Breadth-first', fn: breadthFirst, note: 'Expands every cell at distance d before any at d+1. Always finds the shortest route, and floods the whole maze doing it.' },
  astar: { label: 'A* search', fn: aStar, note: 'Breadth-first, biased toward the goal by straight-line distance. Same answer, a fraction of the cells opened.' },
  wall: { label: 'Wall follower', fn: wallFollower, note: 'Keep your left hand on the wall and walk. Works in any maze without loops, needs no memory, and rarely finds the short way.' },
  fill: { label: 'Dead-end filling', fn: deadEndFill, note: 'Ignores the goal entirely: plug every dead end, repeatedly, and the solution is whatever corridor is left standing.' },
  longest: { label: 'Longest path', fn: longestPath, note: 'Two breadth-first sweeps find the maze’s diameter — the hardest pair of cells it can pose.' },
};

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

export function createGeneration(algorithm, w, h, seed) {
  const grid = new Grid(w, h);
  const rng = new Rng(seed);
  const ctx = { state: new Uint8Array(grid.size), head: -1 };
  const gen = GENERATORS[algorithm] || GENERATORS.backtracker;
  return { grid, ctx, iter: gen.fn(grid, rng, ctx), rng };
}

export function createSolve(kind, grid, start, goal) {
  const ctx = { seen: new Uint8Array(grid.size), head: -1, path: [], endpoints: null };
  const solver = SOLVERS[kind] || SOLVERS.bfs;
  return { ctx, iter: solver.fn(grid, ctx, start, goal) };
}

/** Run an iterator to completion, with a hard cap so a pathological seed cannot hang. */
export function drain(iter, cap = 8e6) {
  let n = 0;
  while (n++ < cap) if (iter.next().done) return true;
  return false;
}
