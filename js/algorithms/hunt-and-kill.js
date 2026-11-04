// Hunt-and-kill: random walk until stuck, then scan for an unvisited cell next to the
// maze, connect it, and continue walking from there.
export function huntAndKill(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  const visited = new Uint8Array(g.n);
  const cand = new Int32Array(D);
  let cur = cells[rng.int(count)];
  visited[cur] = 1;
  let done = 1;
  let scan = 0;
  for (;;) {
    let k = 0;
    for (let s = 0; s < D; s++) {
      const nb = nbr[cur * D + s];
      if (nb >= 0 && !visited[nb]) cand[k++] = s;
    }
    if (k) {
      const s = cand[rng.int(k)];
      const nb = nbr[cur * D + s];
      g.link(cur, s);
      visited[nb] = 1;
      cur = nb;
    } else {
      while (scan < count && visited[cells[scan]]) scan++;
      let found = -1;
      for (let j = scan; j < count; j++) {
        const c = cells[j];
        if (visited[c]) continue;
        k = 0;
        for (let s = 0; s < D; s++) {
          const nb = nbr[c * D + s];
          if (nb >= 0 && visited[nb]) cand[k++] = s;
        }
        if (k) {
          g.link(c, cand[rng.int(k)]);
          visited[c] = 1;
          found = c;
          break;
        }
      }
      if (found < 0) break;
      cur = found;
    }
    if ((++done & 0xffff) === 0 && progress) progress(done / count);
  }
}
