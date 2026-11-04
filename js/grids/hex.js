import { Grid } from './grid.js';

// Flat-topped hexagons in axial coordinates (q, r), circumradius 1.
// Slots: 0 = N, 1 = NE, 2 = SE, 3 = S, 4 = SW, 5 = NW. Opposite slot is (s + 3) % 6.
const SQ3 = Math.sqrt(3);
const DIRS = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];
const COS = [];
const SIN = [];
for (let k = 0; k < 6; k++) {
  COS.push(Math.cos((Math.PI / 3) * k));
  SIN.push(Math.sin((Math.PI / 3) * k));
}

export class HexGrid extends Grid {
  constructor(coords) {
    super(coords.length, 6);
    this.kind = 'hex';
    const index = new Map();
    const key = (q, r) => (q + 32768) * 65536 + (r + 32768);
    coords.forEach(([q, r], i) => index.set(key(q, r), i));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    coords.forEach(([q, r], i) => {
      for (let s = 0; s < 3; s++) {
        const j = index.get(key(q + DIRS[s][0], r + DIRS[s][1]));
        if (j !== undefined) this.connect(i, s, j, s + 3);
      }
      const x = 1.5 * q;
      const y = SQ3 * (r + q / 2);
      this.cx[i] = x;
      this.cy[i] = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    this.bounds = { x0: minX - 1, y0: minY - SQ3 / 2, x1: maxX + 1, y1: maxY + SQ3 / 2 };
  }

  static rect(w, h) {
    const coords = [];
    for (let c = 0; c < w; c++) for (let row = 0; row < h; row++) coords.push([c, row - ((c - (c & 1)) >> 1)]);
    return new HexGrid(coords);
  }

  // A hexagon with `size` cells along each side.
  static hexagon(size) {
    const R = size - 1;
    const coords = [];
    for (let q = -R; q <= R; q++) {
      for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) coords.push([q, r]);
    }
    return new HexGrid(coords);
  }

  edges(i) {
    const x = this.cx[i];
    const y = this.cy[i];
    const out = [];
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6;
      out.push({ s: (k + 2) % 6, x1: x + COS[k], y1: y + SIN[k], x2: x + COS[k2], y2: y + SIN[k2] });
    }
    return out;
  }
}
