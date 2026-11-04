import { Rng } from './rng.js';
import { buildGrid, isPlainRect } from './grids/build.js';
import { getAlgorithm } from './algorithms/index.js';
import { difficultyParams } from './difficulty.js';
import { braid, solve, countDeadEnds } from './solver.js';
import { placeEnds, openingEdge } from './placement.js';

// Runs the whole pipeline: build grid, carve, braid, place ends, solve.
// Returns plain data (typed arrays + numbers) that can be posted from a worker.
export function runGeneration(params, image, progress = () => {}) {
  const t0 = Date.now();
  const grid = buildGrid(params, image);
  const rng = new Rng(`${params.seed}|${params.algo}|${params.difficulty}`);
  let algo = getAlgorithm(params.algo);
  if (algo.rectOnly && !isPlainRect(params)) algo = getAlgorithm('growing-tree');
  const edgeOnly = params.edgeOnly !== false;
  const diff = difficultyParams(params.difficulty, params.cellType, edgeOnly);

  algo.fn(grid, rng, { bias: diff.bias }, (f) => progress(f * 0.85));
  progress(0.86);
  braid(grid, rng, diff.braid);

  const mode = params.placement === 'auto' || !params.placement ? diff.placement : params.placement;
  const { start, end } = placeEnds(grid, mode, rng, edgeOnly);
  progress(0.93);
  const solution = solve(grid, start, end);
  const openStart = params.openings ? openingEdge(grid, start) : -1;
  const openEnd = params.openings ? openingEdge(grid, end) : -1;
  const deadEnds = countDeadEnds(grid);
  progress(1);

  return {
    links: grid.links,
    start,
    end,
    solution,
    openStart,
    openEnd,
    stats: {
      cells: grid.count,
      solutionLength: solution.length,
      deadEnds,
      coverage: solution.length / grid.count,
      algorithm: algo.id,
      placement: mode,
      ms: Date.now() - t0,
    },
  };
}

// Combines a grid built on this thread with the result data.
export function assembleMaze(params, image, result) {
  const grid = buildGrid(params, image);
  grid.links = result.links;
  return { grid, params, ...result };
}
