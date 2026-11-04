// Randomized Prim's: repeatedly picks a random frontier cell and connects it to a random
// neighbor that is already in the maze.
export function prim(g, rng, opts, progress) {
  const { D, nbr, cells, count } = g;
  const IN = 1;
  const FRONTIER = 2;
  const state = new Uint8Array(g.n);
  const frontier = new Int32Array(count);
  const cand = new Int32Array(D);
  let len = 0;
  let done = 0;

  const add = (c) => {
    state[c] = IN;
    done++;
    for (let s = 0; s < D; s++) {
      const nb = nbr[c * D + s];
      if (nb >= 0 && state[nb] === 0) {
        state[nb] = FRONTIER;
        frontier[len++] = nb;
      }
    }
  };

  add(cells[rng.int(count)]);
  while (len) {
    const idx = rng.int(len);
    const c = frontier[idx];
    frontier[idx] = frontier[--len];
    let k = 0;
    for (let s = 0; s < D; s++) {
      const nb = nbr[c * D + s];
      if (nb >= 0 && state[nb] === IN) cand[k++] = s;
    }
    g.link(c, cand[rng.int(k)]);
    add(c);
    if ((done & 0xffff) === 0 && progress) progress(done / count);
  }
}
