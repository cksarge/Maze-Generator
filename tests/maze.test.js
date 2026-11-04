import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../js/rng.js';
import { buildGrid } from '../js/grids/build.js';
import { ALGORITHMS } from '../js/algorithms/index.js';
import { bfs, solve, braid } from '../js/solver.js';
import { runGeneration } from '../js/generate.js';
import { MASKS } from '../js/grids/masks.js';

const SHAPES = [
  { cellType: 'square', outline: 'rect', w: 23, h: 17 },
  { cellType: 'square', outline: 'heart', w: 30, h: 30 },
  { cellType: 'square', outline: 'ring', w: 30, h: 30 },
  { cellType: 'hex', outline: 'rect', w: 15, h: 12 },
  { cellType: 'hex', outline: 'natural', size: 8 },
  { cellType: 'hex', outline: 'star', w: 25, h: 25 },
  { cellType: 'tri', outline: 'rect', w: 21, h: 11 },
  { cellType: 'tri', outline: 'natural', size: 12 },
  { cellType: 'tri', outline: 'circle', w: 30, h: 16 },
  { cellType: 'polar', rings: 12 },
];

function passages(g) {
  let n = 0;
  for (let j = 0; j < g.count; j++) n += g.degree(g.cells[j]);
  return n / 2;
}

function assertSymmetric(g) {
  const { D, nbr, rev, links } = g;
  for (let j = 0; j < g.count; j++) {
    const c = g.cells[j];
    for (let s = 0; s < D; s++) {
      const nb = nbr[c * D + s];
      if (nb < 0) {
        assert.equal((links[c] >> s) & 1, 0, 'link into nothing');
        continue;
      }
      assert.equal(nbr[nb * D + rev[c * D + s]], c, 'neighbor not symmetric');
      assert.equal((links[c] >> s) & 1, (links[nb] >> rev[c * D + s]) & 1, 'link not symmetric');
    }
  }
}

function isPerfect(g) {
  assertSymmetric(g);
  assert.equal(passages(g), g.count - 1, 'a perfect maze has exactly cells - 1 passages');
  assert.equal(bfs(g, g.cells[0]).reached, g.count, 'every cell must be reachable');
}

for (const shape of SHAPES) {
  const plain = shape.cellType === 'square' && shape.outline === 'rect';
  for (const algo of ALGORITHMS) {
    if (algo.rectOnly && !plain) continue;
    test(`${algo.id} makes a perfect maze on ${shape.cellType}/${shape.outline}`, () => {
      for (const seed of ['a', 'b', 'c']) {
        const g = buildGrid(shape);
        algo.fn(g, new Rng(seed), { bias: 0.5 });
        isPerfect(g);
      }
    });
  }
}

test('every preset mask leaves one connected region', () => {
  for (const name of Object.keys(MASKS)) {
    const g = buildGrid({ cellType: 'square', outline: name, w: 40, h: 40 });
    assert.ok(g.count > 50, `${name} should keep cells`);
    g.linkAll();
    assert.equal(bfs(g, g.cells[0]).reached, g.count, `${name} not connected`);
  }
});

test('image mask keeps the largest connected region', () => {
  // Two blobs: a big one on the left, a small one on the right.
  const w = 20;
  const h = 10;
  const data = new Uint8Array(w * h);
  for (let y = 1; y < 9; y++) for (let x = 1; x < 10; x++) data[y * w + x] = 1;
  for (let y = 2; y < 4; y++) for (let x = 15; x < 17; x++) data[y * w + x] = 1;
  const g = buildGrid({ cellType: 'square', outline: 'image', w: 20, h: 10 }, { data, w, h });
  assert.equal(g.count, 8 * 9);
});

test('braiding keeps the maze connected and adds loops', () => {
  const g = buildGrid({ cellType: 'square', outline: 'rect', w: 30, h: 30 });
  ALGORITHMS[1].fn(g, new Rng(1), {});
  braid(g, new Rng(2), 0.6);
  assertSymmetric(g);
  assert.ok(passages(g) > g.count - 1);
  assert.equal(bfs(g, g.cells[0]).reached, g.count);
});

test('solver returns a valid shortest path', () => {
  const g = buildGrid({ cellType: 'hex', outline: 'natural', size: 10 });
  ALGORITHMS[0].fn(g, new Rng('x'), { bias: 0.5 });
  const a = g.cells[0];
  const b = g.cells[g.count - 1];
  const path = solve(g, a, b);
  assert.equal(path[0], a);
  assert.equal(path[path.length - 1], b);
  for (let k = 1; k < path.length; k++) {
    const s = g.slotTo(path[k - 1], path[k]);
    assert.ok(s >= 0 && g.linked(path[k - 1], s), 'path step must follow a passage');
  }
  assert.equal(path.length - 1, bfs(g, a).dist[b]);
});

test('generation is deterministic for a seed', () => {
  const p = { cellType: 'square', outline: 'rect', w: 25, h: 25, algo: 'wilson', difficulty: 6, seed: 'hello', placement: 'auto', openings: true };
  const r1 = runGeneration(p);
  const r2 = runGeneration(p);
  assert.deepEqual(r1.links, r2.links);
  assert.equal(r1.start, r2.start);
  assert.equal(r1.end, r2.end);
  const r3 = runGeneration({ ...p, seed: 'other' });
  assert.notDeepEqual(r1.links, r3.links);
});

test('every difficulty and placement produces a solvable maze with openings', () => {
  for (let d = 1; d <= 10; d++) {
    for (const placement of ['auto', 'corners', 'edges', 'farthest', 'center', 'random']) {
      for (const shape of [SHAPES[0], SHAPES[4], SHAPES[7], SHAPES[9]]) {
        const r = runGeneration({ ...shape, algo: 'growing-tree', difficulty: d, seed: `s${d}`, placement, openings: true });
        assert.ok(r.solution.length >= 2, 'solution should exist');
        assert.notEqual(r.start, r.end);
      }
    }
  }
  const easy = runGeneration({ ...SHAPES[0], w: 40, h: 40, algo: 'growing-tree', difficulty: 1, seed: 'q', placement: 'auto' });
  const hard = runGeneration({ ...SHAPES[0], w: 40, h: 40, algo: 'growing-tree', difficulty: 10, seed: 'q', placement: 'auto' });
  assert.ok(hard.stats.deadEnds > 0);
  assert.ok(easy.stats.solutionLength < hard.stats.solutionLength, 'harder mazes should have longer solutions');
});

test('rect-only algorithms fall back on other shapes', () => {
  const r = runGeneration({ ...SHAPES[3], algo: 'eller', difficulty: 5, seed: 'z', placement: 'auto' });
  assert.equal(r.stats.algorithm, 'growing-tree');
});

test('large maze generates in reasonable time', () => {
  const t = Date.now();
  const r = runGeneration({ cellType: 'square', outline: 'rect', w: 1000, h: 1000, algo: 'backtracker', difficulty: 8, seed: 'big', placement: 'auto' });
  assert.equal(r.stats.cells, 1e6);
  assert.ok(Date.now() - t < 15000, `took ${Date.now() - t}ms`);
});

test('with edgeOnly, start and finish are always on the outside edge with an opening', () => {
  const shapes = [...SHAPES, { cellType: 'square', outline: 'ring', w: 40, h: 40 }, { cellType: 'hex', outline: 'ring', w: 40, h: 35 }];
  for (const shape of shapes) {
    for (let d = 1; d <= 10; d++) {
      for (const placement of ['auto', 'corners', 'edges', 'farthest', 'center', 'random']) {
        const p = { ...shape, algo: 'wilson', difficulty: d, seed: `e${d}${placement}`, placement, openings: true, edgeOnly: true };
        const r = runGeneration(p);
        const g = buildGrid(p);
        assert.ok(g.isOuter(r.start) && g.isOuter(r.end), `${shape.cellType}/${shape.outline} d${d} ${placement}`);
        assert.ok(r.openStart >= 0 && r.openEnd >= 0, 'both ends should get an opening');
      }
    }
  }
});

test('edgeOnly is the default and can be turned off', () => {
  const base = { cellType: 'square', outline: 'rect', w: 30, h: 30, algo: 'wilson', difficulty: 10, seed: 'inside', placement: 'farthest', openings: true };
  const g = buildGrid(base);
  const def = runGeneration(base);
  assert.ok(g.isOuter(def.start) && g.isOuter(def.end));
  let interior = false;
  for (let k = 0; k < 20 && !interior; k++) {
    const r = runGeneration({ ...base, seed: `inside${k}`, edgeOnly: false });
    interior = !g.isOuter(r.start) || !g.isOuter(r.end);
  }
  assert.ok(interior, 'with edgeOnly off, farthest placement can use interior cells');
});

test('walls around an enclosed hole do not count as the outside edge', () => {
  const g = buildGrid({ cellType: 'square', outline: 'ring', w: 40, h: 40 });
  let nearest = -1;
  let bd = Infinity;
  for (const c of g.cells) {
    const d = (g.cx[c] - 20) ** 2 + (g.cy[c] - 20) ** 2;
    if (d < bd) {
      bd = d;
      nearest = c;
    }
  }
  assert.ok(!g.isOuter(nearest), 'cell on the inner rim of the ring should not be outer');
  assert.ok(g.isOuter(g.cells[0]), 'top-most cell is on the outside');
});

test('SVG output splits walls into several paths so huge mazes still render', async () => {
  const { mazeSVGParts } = await import('../js/render/svg.js');
  const { BATCH } = await import('../js/render/walls.js');
  const { assembleMaze } = await import('../js/generate.js');
  const p = { cellType: 'square', outline: 'rect', w: 400, h: 400, algo: 'backtracker', difficulty: 5, seed: 'svg', placement: 'auto', openings: true };
  const maze = assembleMaze(p, null, runGeneration(p));
  const svg = mazeSVGParts(maze, { solution: true }).join('');
  const paths = svg.split('<path d=').length - 1;
  const segments = svg.split(/[ML]/).length;
  assert.ok(paths >= 3, `expected several paths, got ${paths}`);
  for (const chunk of svg.split('<path d=').slice(1)) {
    assert.ok(chunk.split('M').length - 1 <= BATCH, 'each path stays under the batch size');
  }
  assert.ok(segments > BATCH);
});
