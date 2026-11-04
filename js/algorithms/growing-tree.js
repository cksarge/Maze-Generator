// Growing tree: keeps a list of active cells and extends from either the newest cell
// (like the backtracker) or a random one (like Prim's). opts.bias is the probability of
// picking the newest cell, which is how difficulty tunes this algorithm.
export function growingTree(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  const bias = opts.bias ?? 0.75;
  const visited = new Uint8Array(g.n);
  const list = new Int32Array(count);
  const cand = new Int32Array(D);
  let len = 0;
  let done = 1;
  const first = cells[rng.int(count)];
  visited[first] = 1;
  list[len++] = first;
  while (len) {
    const idx = rng.chance(bias) ? len - 1 : rng.int(len);
    const c = list[idx];
    let k = 0;
    for (let s = 0; s < D; s++) {
      const nb = nbr[c * D + s];
      if (nb >= 0 && !visited[nb]) cand[k++] = s;
    }
    if (!k) {
      list[idx] = list[--len];
      continue;
    }
    const s = cand[rng.int(k)];
    const nb = nbr[c * D + s];
    g.link(c, s);
    visited[nb] = 1;
    list[len++] = nb;
    if ((++done & 0xffff) === 0 && progress) progress(done / count);
  }
}
