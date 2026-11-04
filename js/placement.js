import { bfs } from './solver.js';

// Chooses start and finish cells.
//   corners  - outside-edge cells nearest the top-left and bottom-right
//   edges    - the two outside-edge cells farthest apart along the maze's paths
//   farthest - the two cells farthest apart anywhere (longest possible solution)
//   center   - start at the middle, finish on the edge farthest from it
//   random   - any two different cells
// With edgeOnly, both ends are always on the outside edge: "farthest" and "center" become
// "edges", and "random" picks from outside-edge cells.
export function placeEnds(g, mode, rng, edgeOnly = false) {
  const { cells, count, cx, cy } = g;
  let anyOuter = false;
  for (let j = 0; j < count && !anyOuter; j++) anyOuter = g.isOuter(cells[j]);
  const pool = (c) => !anyOuter || g.isOuter(c);
  if (edgeOnly && (mode === 'farthest' || mode === 'center')) mode = 'edges';
  const farthestIn = (dist, filter) => {
    let best = -1;
    let bd = -1;
    for (let j = 0; j < count; j++) {
      const c = cells[j];
      if (filter(c) && dist[c] > bd) {
        bd = dist[c];
        best = c;
      }
    }
    return best;
  };
  const extreme = (sign) => {
    let best = -1;
    let bv = Infinity;
    for (let j = 0; j < count; j++) {
      const c = cells[j];
      if (!pool(c)) continue;
      const v = sign * (cx[c] + cy[c]);
      if (v < bv) {
        bv = v;
        best = c;
      }
    }
    return best;
  };

  let start;
  let end;
  switch (mode) {
    case 'corners':
      start = extreme(1);
      end = extreme(-1);
      break;
    case 'center': {
      const b = g.bounds;
      const mx = (b.x0 + b.x1) / 2;
      const my = (b.y0 + b.y1) / 2;
      let bd = Infinity;
      for (let j = 0; j < count; j++) {
        const c = cells[j];
        const d = (cx[c] - mx) ** 2 + (cy[c] - my) ** 2;
        if (d < bd) {
          bd = d;
          start = c;
        }
      }
      end = farthestIn(bfs(g, start).dist, pool);
      break;
    }
    case 'farthest': {
      const a = bfs(g, cells[0]).far;
      start = a;
      end = bfs(g, a).far;
      break;
    }
    case 'random': {
      let options = cells;
      if (edgeOnly && anyOuter) {
        options = cells.filter((c) => g.isOuter(c));
        if (options.length < 2) options = cells;
      }
      start = options[rng.int(options.length)];
      do end = options[rng.int(options.length)];
      while (end === start);
      break;
    }
    default: {
      // edges
      const a = farthestIn(bfs(g, extreme(1)).dist, pool);
      start = a;
      end = farthestIn(bfs(g, a).dist, pool);
    }
  }
  if (start === end) end = cells[start === cells[0] ? 1 : 0];
  return { start, end };
}

// For a cell on the outside edge, the index (in grid.edges) of the outer wall facing most
// directly away from the maze's center, so it can be left open as an entrance/exit.
// -1 if the cell has no outside wall.
export function openingEdge(g, cell) {
  const es = g.edges(cell);
  const b = g.bounds;
  const mx = (b.x0 + b.x1) / 2;
  const my = (b.y0 + b.y1) / 2;
  let best = -1;
  let bd = -1;
  es.forEach((e, k) => {
    if (!g.isOuterEdge(cell, e)) return;
    let ex = (e.x1 + e.x2) / 2;
    let ey = (e.y1 + e.y2) / 2;
    if (e.arc) {
      const a = (e.a1 + e.a2) / 2;
      ex = e.cx + e.r * Math.cos(a);
      ey = e.cy + e.r * Math.sin(a);
    }
    const d = (ex - mx) ** 2 + (ey - my) ** 2;
    if (d > bd) {
      bd = d;
      best = k;
    }
  });
  return best;
}
