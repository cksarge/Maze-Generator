// Shared wall-tracing logic used by the canvas view, PNG export and SVG/print output.

// Calls emit(e) for every wall that should be drawn for the cells passed to `each`.
// Shared walls are emitted once (by the lower-numbered cell); walls of opened passages
// and the start/finish openings are skipped.
export function forEachWall(maze, each, emit) {
  const g = maze.grid;
  const { nbr, D, links } = g;
  const { start, end, openStart, openEnd } = maze;
  each((i) => {
    const es = g.edges(i);
    for (let k = 0; k < es.length; k++) {
      const e = es[k];
      const nb = e.s >= 0 ? nbr[i * D + e.s] : -1;
      if (nb >= 0) {
        if ((links[i] >> e.s) & 1) continue;
        if (nb < i) continue;
      } else if ((i === start && k === openStart) || (i === end && k === openEnd)) {
        continue;
      }
      emit(e);
    }
  });
}

export function allCells(grid) {
  return (fn) => {
    const { cells, count } = grid;
    for (let j = 0; j < count; j++) fn(cells[j]);
  };
}

// Browsers silently draw nothing when a single canvas path or SVG <path> has too many
// segments (around a million in Chrome), so long paths are drawn in batches of this size.
export const BATCH = 50000;

export function traceWalls(ctx, maze, each) {
  let n = 0;
  ctx.beginPath();
  forEachWall(maze, each, (e) => {
    ctx.moveTo(e.x1, e.y1);
    if (e.arc) ctx.arc(e.cx, e.cy, e.r, e.a1, e.a2);
    else ctx.lineTo(e.x2, e.y2);
    if (++n === BATCH) {
      ctx.stroke();
      ctx.beginPath();
      n = 0;
    }
  });
  ctx.stroke();
}

export function tracePath(ctx, grid, path, len = path.length) {
  if (len < 1) return;
  ctx.beginPath();
  ctx.moveTo(grid.cx[path[0]], grid.cy[path[0]]);
  for (let k = 1; k < len; k++) {
    ctx.lineTo(grid.cx[path[k]], grid.cy[path[k]]);
    if (k % BATCH === 0) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(grid.cx[path[k]], grid.cy[path[k]]);
    }
  }
  if (len === 1) ctx.lineTo(grid.cx[path[0]] + 0.001, grid.cy[path[0]]);
  ctx.stroke();
}
