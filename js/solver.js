// Graph searches over the carved passages.

// Breadth-first search from src. Returns distances (-1 = unreachable), BFS parents and
// the last (farthest) cell reached.
export function bfs(g, src, wantParent = false) {
  const { D, nbr, links } = g;
  const dist = new Int32Array(g.n).fill(-1);
  const parent = wantParent ? new Int32Array(g.n).fill(-1) : null;
  const queue = new Int32Array(g.count);
  let head = 0;
  let tail = 0;
  dist[src] = 0;
  queue[tail++] = src;
  let far = src;
  while (head < tail) {
    const c = queue[head++];
    far = c;
    const m = links[c];
    const dc = dist[c] + 1;
    for (let s = 0; s < D; s++) {
      if (!((m >> s) & 1)) continue;
      const nb = nbr[c * D + s];
      if (dist[nb] < 0) {
        dist[nb] = dc;
        if (parent) parent[nb] = c;
        queue[tail++] = nb;
      }
    }
  }
  return { dist, parent, far, reached: tail };
}

// Shortest path from a to b as an Int32Array of cells (empty if unreachable).
export function solve(g, a, b) {
  const { dist, parent } = bfs(g, a, true);
  if (dist[b] < 0) return new Int32Array(0);
  const path = new Int32Array(dist[b] + 1);
  let c = b;
  for (let k = path.length - 1; k >= 0; k--) {
    path[k] = c;
    c = parent[c];
  }
  return path;
}

export function countDeadEnds(g) {
  let n = 0;
  for (let j = 0; j < g.count; j++) if (g.degree(g.cells[j]) === 1) n++;
  return n;
}

// Removes a fraction of dead ends by opening one extra wall, which adds loops.
export function braid(g, rng, fraction) {
  if (fraction <= 0) return;
  const { D, nbr, cells, count } = g;
  const dead = [];
  for (let j = 0; j < count; j++) if (g.degree(cells[j]) === 1) dead.push(cells[j]);
  rng.shuffle(dead);
  const cand = new Int32Array(D);
  const best = new Int32Array(D);
  for (const c of dead) {
    if (g.degree(c) !== 1 || !rng.chance(fraction)) continue;
    let k = 0;
    let kb = 0;
    for (let s = 0; s < D; s++) {
      const nb = nbr[c * D + s];
      if (nb < 0 || g.linked(c, s)) continue;
      cand[k++] = s;
      if (g.degree(nb) === 1) best[kb++] = s;
    }
    if (kb) g.link(c, best[rng.int(kb)]);
    else if (k) g.link(c, cand[rng.int(k)]);
  }
}
