# Amaze

An interactive plate for looking at maze algorithms. Nine generators carve a
grid while you watch; four solvers cross it afterwards; a set of measurements
underneath tells you what kind of maze each method actually makes.

The point is that **every algorithm leaves a fingerprint**. A recursive
backtracker produces long, river-like corridors and very few dead ends. Prim's
produces the opposite — short stubs radiating from a seed. Binary tree leaves a
diagonal grain and two unbroken corridors along the north and east edges, every
single time. The *Signature* meters put numbers on that intuition.

## What's here

**Generators** — recursive backtracker, Prim's (simplified), Kruskal's,
Wilson's, Eller's, hunt-and-kill, recursive division, sidewinder, binary tree.

**Solvers** — breadth-first, A*, wall follower, dead-end filling, and the
maze's own longest path (its graph diameter, found with two BFS sweeps).

**Controls** — grid resolution, a text seed so any figure is reproducible,
braiding (reopening dead ends into loops, which turns the tree into a graph
with real choices), animation pace, and three rendering modes: solid ink,
distance field, and classic wall lines.

Click any cell to move the origin of the distance field; shift-click to move
the goal. `G` carves, `T` traces, `R` reseeds.

## Measurements

| Readout | What it tells you |
| --- | --- |
| Dead ends | Cells with one exit, as a share of the grid — the clearest separator between methods |
| Twistiness | Of the corridor cells, the fraction that turn rather than run straight |
| Grain | Directional bias: −1 all passages run north–south, +1 all run east–west |
| Diameter | Longest shortest-path in the maze; the hardest pair of cells it can pose |
| Loops | Passages beyond the `cells − 1` of a perfect maze. Zero until you braid |

## Layout

```
src/engine.js    grid, seeded PRNG, generators, solvers, metrics — no DOM
src/app.js       canvas rendering, controls, animation clock
src/style.css    tokens and layout for both themes
src/template.html   page shell with inline slots
build.mjs        splices src/ into dist/amaze.html, one self-contained file
test/engine.test.mjs
```

Generators and solvers are `function*`s that yield once per elementary step.
That single choice is what lets the same code run instantly for a test and
frame-by-frame for the animation, with no scheduling logic inside the
algorithms themselves.

## Working on it

```sh
node --test test/engine.test.mjs   # 40 checks
node build.mjs                     # -> dist/amaze.html
```

The tests assert the property that matters: at every size, each generator must
produce a *perfect* maze — every cell reachable, exactly `cells − 1` passages,
no one-way links, and identical output for identical seeds. They also check
that braiding removes dead ends without severing the maze, that BFS and A*
agree on distance while A* opens fewer cells, and that every solver returns a
path you can actually walk.

## Also in this repo — Salón Tricolor

`salon/` is a second plate, built the same way: a beauty salon for Colombian
public figures. Nine parametric cartoon avatars, a face you make up in layers,
a hand of five nails you file, paint and decorate, and a jury that scores the
result on harmony, daring, campaign coherence and production. Same shape as
Amaze — a testable DOM-free engine, a canvas painter, and a build that splices
everything into one self-contained page.

```sh
node --test salon/test/engine.test.mjs   # 13 checks
node salon/build.mjs                     # -> salon/dist/salon.html
```

See [salon/README.md](salon/README.md) (in Spanish, like the app itself).
