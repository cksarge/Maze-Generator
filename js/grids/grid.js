// Base graph model shared by every maze shape.
//
// Every cell has up to D neighbor "slots". nbr[i*D+s] is the neighbor in slot s (or -1),
// rev[i*D+s] is the slot that points back from that neighbor, and links[i] is a bitmask
// of slots that have an open passage. Subclasses supply geometry: cell centers (cx, cy),
// bounds, and edges(i), which lists the wall segments/arcs of a cell with their slot.

export class Grid {
  constructor(n, D) {
    if (D > 8) throw new Error('Grid supports at most 8 neighbors per cell');
    this.n = n;
    this.D = D;
    this.nbr = new Int32Array(n * D).fill(-1);
    this.rev = new Int8Array(n * D).fill(-1);
    this.links = new Uint8Array(n);
    this.active = new Uint8Array(n).fill(1);
    this.cx = new Float32Array(n);
    this.cy = new Float32Array(n);
    this.cells = null;
    this.count = 0;
    this.bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };
  }

  connect(a, sa, b, sb) {
    const D = this.D;
    this.nbr[a * D + sa] = b;
    this.rev[a * D + sa] = sb;
    this.nbr[b * D + sb] = a;
    this.rev[b * D + sb] = sa;
  }

  link(a, s) {
    const k = a * this.D + s;
    this.links[a] |= 1 << s;
    this.links[this.nbr[k]] |= 1 << this.rev[k];
  }

  unlink(a, s) {
    const k = a * this.D + s;
    this.links[a] &= ~(1 << s);
    this.links[this.nbr[k]] &= ~(1 << this.rev[k]);
  }

  linked(a, s) {
    return (this.links[a] >> s) & 1;
  }

  slotTo(a, b) {
    const D = this.D;
    for (let s = 0; s < D; s++) if (this.nbr[a * D + s] === b) return s;
    return -1;
  }

  degree(a) {
    let m = this.links[a];
    let c = 0;
    while (m) {
      m &= m - 1;
      c++;
    }
    return c;
  }

  isBoundary(i) {
    const es = this.edges(i);
    for (const e of es) if (e.s < 0 || this.nbr[i * this.D + e.s] < 0) return true;
    return false;
  }

  linkAll() {
    const { D, nbr, cells, count } = this;
    for (let j = 0; j < count; j++) {
      const c = cells[j];
      for (let s = 0; s < D; s++) {
        const nb = nbr[c * D + s];
        if (nb > c) this.link(c, s);
      }
    }
  }

  // Applies an optional activeTest(i) -> bool, cuts links to inactive cells and keeps only
  // the largest connected region so every remaining cell is reachable.
  finalize(activeTest) {
    const { n, D, nbr, active } = this;
    if (activeTest) for (let i = 0; i < n; i++) active[i] = activeTest(i) ? 1 : 0;
    this._cutInactive();

    const comp = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    let best = -1;
    let bestSize = 0;
    let id = 0;
    for (let i = 0; i < n; i++) {
      if (!active[i] || comp[i] >= 0) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = i;
      comp[i] = id;
      while (head < tail) {
        const c = queue[head++];
        for (let s = 0; s < D; s++) {
          const nb = nbr[c * D + s];
          if (nb >= 0 && comp[nb] < 0) {
            comp[nb] = id;
            queue[tail++] = nb;
          }
        }
      }
      if (tail > bestSize) {
        bestSize = tail;
        best = id;
      }
      id++;
    }
    if (id > 1) {
      for (let i = 0; i < n; i++) if (active[i] && comp[i] !== best) active[i] = 0;
      this._cutInactive();
    }

    this.count = bestSize;
    this.cells = new Int32Array(bestSize);
    let k = 0;
    for (let i = 0; i < n; i++) if (active[i]) this.cells[k++] = i;
    if (this.count < 2) throw new Error('That shape leaves fewer than 2 cells. Try a larger size or a different shape.');
    return this;
  }

  _cutInactive() {
    const { n, D, nbr, rev, active } = this;
    for (let i = 0; i < n; i++) {
      if (active[i]) continue;
      for (let s = 0; s < D; s++) {
        const k = i * D + s;
        const nb = nbr[k];
        if (nb >= 0) {
          const back = nb * D + rev[k];
          nbr[back] = -1;
          rev[back] = -1;
          nbr[k] = -1;
          rev[k] = -1;
        }
      }
    }
  }
}
