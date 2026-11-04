// Randomized Kruskal's: shuffles every wall and removes it when the cells on either side
// are not yet connected (tracked with union-find).
export function kruskal(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  let m = 0;
  for (let j = 0; j < count; j++) {
    const c = cells[j];
    for (let s = 0; s < D; s++) if (nbr[c * D + s] > c) m++;
  }
  const edges = new Int32Array(m);
  m = 0;
  for (let j = 0; j < count; j++) {
    const c = cells[j];
    for (let s = 0; s < D; s++) if (nbr[c * D + s] > c) edges[m++] = c * D + s;
  }
  rng.shuffle(edges);

  const parent = new Int32Array(g.n);
  for (let i = 0; i < g.n; i++) parent[i] = i;
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  let joined = 1;
  for (let e = 0; e < m && joined < count; e++) {
    const k = edges[e];
    const a = (k / D) | 0;
    const ra = find(a);
    const rb = find(nbr[k]);
    if (ra === rb) continue;
    parent[ra] = rb;
    g.link(a, k - a * D);
    if ((++joined & 0xffff) === 0 && progress) progress(joined / count);
  }
}
