// Algorithms that rely on the rows and columns of a plain rectangular grid.
// Rect slots: 0 = north, 1 = east, 2 = south, 3 = west.

// Eller's algorithm: builds the maze one row at a time, tracking which cells in the
// current row are already connected (relabelled each row so memory stays O(width)).
export function eller(g, rng, opts, progress) {
  const { w, h } = g;
  let labels = new Int32Array(w).fill(-1);
  const parent = new Int32Array(w);
  const remap = new Int32Array(w);
  const hasDown = new Uint8Array(w);
  const pick = new Int32Array(w);
  const seen = new Int32Array(w);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  for (let y = 0; y < h; y++) {
    // Compact labels to 0..w-1 and give new cells their own set.
    remap.fill(-1);
    let next = 0;
    for (let x = 0; x < w; x++) {
      const l = labels[x];
      if (l >= 0) {
        if (remap[l] < 0) remap[l] = next++;
        labels[x] = remap[l];
      }
    }
    for (let x = 0; x < w; x++) if (labels[x] < 0) labels[x] = next++;
    for (let x = 0; x < w; x++) parent[x] = x;

    const last = y === h - 1;
    for (let x = 0; x < w - 1; x++) {
      const a = find(labels[x]);
      const b = find(labels[x + 1]);
      if (a !== b && (last || rng.chance(0.5))) {
        g.link(y * w + x, 1);
        parent[a] = b;
      }
    }
    for (let x = 0; x < w; x++) labels[x] = find(labels[x]);
    if (last) break;

    // Each set must continue downward at least once.
    hasDown.fill(0);
    const down = new Uint8Array(w);
    for (let x = 0; x < w; x++) {
      if (rng.chance(0.5)) {
        down[x] = 1;
        hasDown[labels[x]] = 1;
      }
    }
    seen.fill(0);
    for (let x = 0; x < w; x++) {
      const l = labels[x];
      if (hasDown[l]) continue;
      seen[l]++;
      if (rng.int(seen[l]) === 0) pick[l] = x;
    }
    for (let x = 0; x < w; x++) {
      const l = labels[x];
      if (!hasDown[l] && pick[l] === x) down[x] = 1;
    }
    const nextLabels = new Int32Array(w).fill(-1);
    for (let x = 0; x < w; x++) {
      if (down[x]) {
        g.link(y * w + x, 2);
        nextLabels[x] = labels[x];
      }
    }
    labels = nextLabels;
    if (progress && (y & 255) === 0) progress(y / h);
  }
}

// Sidewinder: runs of eastward passages, each run closed off by one passage north.
export function sidewinder(g, rng, opts, progress) {
  const { w, h } = g;
  for (let y = 0; y < h; y++) {
    let runStart = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const atEast = x === w - 1;
      if (y === 0) {
        if (!atEast) g.link(i, 1);
        continue;
      }
      if (atEast || rng.chance(0.5)) {
        const cx = runStart + rng.int(x - runStart + 1);
        g.link(y * w + cx, 0);
        runStart = x + 1;
      } else {
        g.link(i, 1);
      }
    }
    if (progress && (y & 255) === 0) progress(y / h);
  }
}

// Binary tree: every cell opens either north or west.
export function binaryTree(g, rng, opts, progress) {
  const { w, h } = g;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const north = y > 0;
      const west = x > 0;
      if (north && west) g.link(i, rng.chance(0.5) ? 0 : 3);
      else if (north) g.link(i, 0);
      else if (west) g.link(i, 3);
    }
    if (progress && (y & 255) === 0) progress(y / h);
  }
}

// Recursive division: starts with an open field and splits it with walls that each have
// a single gap.
export function recursiveDivision(g, rng, opts, progress) {
  const { w, h } = g;
  g.linkAll();
  const stack = [[0, 0, w, h]];
  let steps = 0;
  while (stack.length) {
    const [x, y, rw, rh] = stack.pop();
    if (rw < 2 || rh < 2) continue;
    const horizontal = rh > rw ? true : rw > rh ? false : rng.chance(0.5);
    if (horizontal) {
      const wy = y + rng.int(rh - 1); // wall below row wy
      const gap = x + rng.int(rw);
      for (let cx = x; cx < x + rw; cx++) if (cx !== gap) g.unlink(wy * w + cx, 2);
      stack.push([x, y, rw, wy - y + 1], [x, wy + 1, rw, y + rh - wy - 1]);
    } else {
      const wx = x + rng.int(rw - 1); // wall right of column wx
      const gap = y + rng.int(rh);
      for (let cy = y; cy < y + rh; cy++) if (cy !== gap) g.unlink(cy * w + wx, 1);
      stack.push([x, y, wx - x + 1, rh], [wx + 1, y, x + rw - wx - 1, rh]);
    }
    if (progress && (++steps & 0xffff) === 0) progress(Math.min(0.99, steps / (w * h)));
  }
}
