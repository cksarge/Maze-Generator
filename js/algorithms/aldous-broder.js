// Aldous-Broder: a pure random walk that carves into every cell it visits for the first
// time. Uniform like Wilson's, but very slow to finish on large mazes.
export function aldousBroder(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  const visited = new Uint8Array(g.n);
  const cand = new Int32Array(D);
  let cur = cells[rng.int(count)];
  visited[cur] = 1;
  let remaining = count - 1;
  let steps = 0;
  while (remaining) {
    let k = 0;
    for (let s = 0; s < D; s++) if (nbr[cur * D + s] >= 0) cand[k++] = s;
    const s = cand[rng.int(k)];
    const nb = nbr[cur * D + s];
    if (!visited[nb]) {
      visited[nb] = 1;
      g.link(cur, s);
      remaining--;
    }
    cur = nb;
    if ((++steps & 0xfffff) === 0 && progress) progress(1 - remaining / count);
  }
}
