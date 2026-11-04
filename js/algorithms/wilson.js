// Wilson's algorithm: loop-erased random walks produce a uniformly random spanning tree.
// The loop erasure happens implicitly: each cell remembers only the last direction the
// walk left it by, so retracing from the start follows the loop-free path.
export function wilson(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  const inTree = new Uint8Array(g.n);
  const dir = new Int8Array(g.n);
  const cand = new Int32Array(D);
  inTree[cells[rng.int(count)]] = 1;
  let done = 1;
  let reported = 0;
  for (let j = 0; j < count; j++) {
    const start = cells[j];
    if (inTree[start]) continue;
    let cur = start;
    while (!inTree[cur]) {
      let k = 0;
      for (let s = 0; s < D; s++) if (nbr[cur * D + s] >= 0) cand[k++] = s;
      const s = cand[rng.int(k)];
      dir[cur] = s;
      cur = nbr[cur * D + s];
    }
    cur = start;
    while (!inTree[cur]) {
      const s = dir[cur];
      inTree[cur] = 1;
      g.link(cur, s);
      cur = nbr[cur * D + s];
      done++;
    }
    if (progress && done - reported > 65536) {
      reported = done;
      progress(done / count);
    }
  }
}
