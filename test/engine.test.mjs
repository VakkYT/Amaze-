/**
 * Correctness checks for the maze engine. Run with: node --test test/
 *
 * The interesting property is the same for eight of the nine generators: the
 * result must be a perfect maze — every cell reachable, and exactly one route
 * between any two cells (size - 1 passages). Recursive division is checked the
 * same way; it reaches the property from the opposite direction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATORS, SOLVERS, Grid, Rng, DIRS,
  createGeneration, createSolve, drain, distances, measure, braid, diameter,
} from '../src/engine.js';

const SIZES = [[1, 1], [1, 6], [6, 1], [2, 3], [12, 9], [23, 17]];

function build(name, w, h, seed) {
  const run = createGeneration(name, w, h, seed);
  assert.equal(drain(run.iter), true, `${name} ${w}x${h} did not terminate`);
  return run.grid;
}

function countPassages(g) {
  let n = 0;
  for (let i = 0; i < g.size; i++) {
    if (g.linked(i, 4)) n++;   // E
    if (g.linked(i, 2)) n++;   // S
  }
  return n;
}

for (const name of Object.keys(GENERATORS)) {
  test(`${name}: produces a perfect maze at every size`, () => {
    for (const [w, h] of SIZES) {
      const g = build(name, w, h, `seed-${w}-${h}`);
      const dist = distances(g, 0);
      const unreached = [...dist].filter((d) => d < 0).length;
      assert.equal(unreached, 0, `${name} ${w}x${h}: ${unreached} unreachable cells`);
      assert.equal(countPassages(g), g.size - 1, `${name} ${w}x${h}: wrong passage count`);
    }
  });

  test(`${name}: links are symmetric`, () => {
    const g = build(name, 14, 11, 'symmetry');
    const opp = { 1: 2, 2: 1, 4: 8, 8: 4 };
    for (let i = 0; i < g.size; i++) {
      for (const d of DIRS) {
        const j = g.neighbor(i, d);
        if (j < 0) { assert.ok(!g.linked(i, d), `${name}: passage through the border`); continue; }
        assert.equal(g.linked(i, d), g.linked(j, opp[d]), `${name}: one-way passage at ${i}`);
      }
    }
  });

  test(`${name}: identical seeds give identical mazes`, () => {
    const a = build(name, 17, 13, 'repeatable');
    const b = build(name, 17, 13, 'repeatable');
    const c = build(name, 17, 13, 'different');
    assert.deepEqual([...a.cells], [...b.cells]);
    assert.notDeepEqual([...a.cells], [...c.cells], `${name}: seed made no difference`);
  });
}

test('binary tree shows its signature bias', () => {
  const g = build('binary', 30, 30, 'bias');
  // Its north and east edges are always unbroken corridors.
  for (let x = 0; x < g.w - 1; x++) assert.ok(g.linked(g.idx(x, 0), 4), 'north edge is broken');
  for (let y = 0; y < g.h - 1; y++) assert.ok(g.linked(g.idx(g.w - 1, y), 2), 'east edge is broken');
});

test('sidewinder leaves the top row as one corridor', () => {
  const g = build('sidewinder', 24, 18, 'run');
  for (let x = 0; x < g.w - 1; x++) assert.ok(g.linked(g.idx(x, 0), 4), 'top row is broken');
});

test('backtracker makes longer corridors than Prim', () => {
  const back = measure(build('backtracker', 40, 40, 'texture'));
  const prim = measure(build('prim', 40, 40, 'texture'));
  assert.ok(back.deadEndRatio < prim.deadEndRatio,
    `expected fewer dead ends from the backtracker (${back.deadEndRatio} vs ${prim.deadEndRatio})`);
});

test('braiding removes dead ends and adds loops', () => {
  const g = build('backtracker', 30, 30, 'braid');
  const before = measure(g);
  braid(g, new Rng('braid'), 1);
  const after = measure(g);
  assert.equal(after.deadEnds, 0, 'full braiding should leave no dead ends');
  assert.ok(after.loops > before.loops, 'braiding should add loops');
  assert.equal(distances(g, 0).filter((d) => d < 0).length, 0, 'braiding broke connectivity');
});

test('diameter is the longest shortest-path in the tree', () => {
  const g = build('kruskal', 20, 20, 'diameter');
  const d = diameter(g);
  let worst = 0;
  for (let i = 0; i < g.size; i++) {
    const dist = distances(g, i);
    for (let j = 0; j < g.size; j++) worst = Math.max(worst, dist[j]);
  }
  assert.equal(d.length, worst);
});

for (const kind of Object.keys(SOLVERS)) {
  test(`${kind}: returns a walkable path`, () => {
    for (const name of ['backtracker', 'prim', 'division']) {
      const g = build(name, 21, 15, `solve-${kind}`);
      const start = 0, goal = g.size - 1;
      const run = createSolve(kind, g, start, goal);
      assert.equal(drain(run.iter), true, `${kind} did not terminate`);
      const path = run.ctx.path;
      assert.ok(path.length > 0, `${kind} on ${name}: no path found`);
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1], b = path[k];
        const step = DIRS.find((d) => g.neighbor(a, d) === b);
        assert.ok(step !== undefined && g.linked(a, step),
          `${kind} on ${name}: step ${k} jumps through a wall`);
      }
      if (kind !== 'longest') {
        assert.equal(path[0], start, `${kind}: path does not start at the start`);
        assert.equal(path[path.length - 1], goal, `${kind}: path does not reach the goal`);
      }
    }
  });
}

test('breadth-first and A* agree on the shortest distance', () => {
  const g = build('wilson', 15, 15, 'agree');
  const goal = g.size - 1;
  const bfs = createSolve('bfs', g, 0, goal);
  const astar = createSolve('astar', g, 0, goal);
  drain(bfs.iter); drain(astar.iter);
  assert.equal(bfs.ctx.path.length, astar.ctx.path.length);
  assert.equal(bfs.ctx.path.length - 1, distances(g, 0)[goal]);
});

test('A* opens fewer cells than breadth-first', () => {
  let astarWins = 0;
  for (let s = 0; s < 8; s++) {
    const g = build('backtracker', 30, 30, `effort-${s}`);
    const goal = g.size - 1;
    const bfs = createSolve('bfs', g, 0, goal);
    const astar = createSolve('astar', g, 0, goal);
    drain(bfs.iter); drain(astar.iter);
    const seen = (c) => c.seen.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
    if (seen(astar.ctx) < seen(bfs.ctx)) astarWins++;
  }
  assert.ok(astarWins >= 6, `A* should usually open fewer cells (won ${astarWins}/8)`);
});

test('solvers still work on a braided maze', () => {
  const g = build('backtracker', 25, 25, 'braided-solve');
  braid(g, new Rng('x'), 0.6);
  const goal = g.size - 1;
  const run = createSolve('astar', g, 0, goal);
  drain(run.iter);
  assert.equal(run.ctx.path.length - 1, distances(g, 0)[goal]);
});
