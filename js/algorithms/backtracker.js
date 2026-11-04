// Recursive backtracker (randomized depth-first search), with an explicit stack.
export function backtracker(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  const visited = new Uint8Array(g.n);
  const stack = new Int32Array(count);
  const cand = new Int32Array(D);
  let sp = 0;
  let done = 1;
  const first = cells[rng.int(count)];
  visited[first] = 1;
  stack[sp++] = first;
  while (sp) {
    const c = stack[sp - 1];
    let k = 0;
    for (let s = 0; s < D; s++) {
      const nb = nbr[c * D + s];
      if (nb >= 0 && !visited[nb]) cand[k++] = s;
    }
    if (!k) {
      sp--;
      continue;
    }
    const s = cand[rng.int(k)];
    const nb = nbr[c * D + s];
    g.link(c, s);
    visited[nb] = 1;
    stack[sp++] = nb;
    if ((++done & 0xffff) === 0 && progress) progress(done / count);
  }
}
