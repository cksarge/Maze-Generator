import { Grid } from './grid.js';

// Equilateral triangles with side 1 laid out in rows. Cell (x, y) points up when
// (x + y + offset) is even. Slots: 0 = left, 1 = right, 2 = vertical (below an
// up-triangle, above a down-triangle).
const H = Math.sqrt(3) / 2;

export class TriGrid extends Grid {
  constructor(w, h, offset = 0) {
    super(w * h, 3);
    this.kind = 'tri';
    this.w = w;
    this.h = h;
    this.offset = offset;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const up = this.isUp(x, y);
        if (x + 1 < w) this.connect(i, 1, i + 1, 0);
        if (up && y + 1 < h) this.connect(i, 2, i + w, 2);
        this.cx[i] = x * 0.5 + 0.5;
        this.cy[i] = y * H + (up ? (2 * H) / 3 : H / 3);
      }
    }
    this.bounds = { x0: 0, y0: 0, x1: (w + 1) / 2, y1: h * H };
  }

  isUp(x, y) {
    return ((x + y + this.offset) & 1) === 0;
  }

  // A large triangle with `size` rows; row y holds 2y + 1 cells.
  static triangle(size) {
    const g = new TriGrid(2 * size - 1, size, (size - 1) & 1);
    g.naturalTest = (i) => {
      const x = i % g.w;
      const y = (i - x) / g.w;
      return Math.abs(x - (size - 1)) <= y;
    };
    return g;
  }

  edges(i) {
    const x = i % this.w;
    const y = (i - x) / this.w;
    const l = x * 0.5;
    const top = y * H;
    const bot = top + H;
    if (this.isUp(x, y)) {
      return [
        { s: 1, x1: l + 0.5, y1: top, x2: l + 1, y2: bot },
        { s: 2, x1: l + 1, y1: bot, x2: l, y2: bot },
        { s: 0, x1: l, y1: bot, x2: l + 0.5, y2: top },
      ];
    }
    return [
      { s: 2, x1: l, y1: top, x2: l + 1, y2: top },
      { s: 1, x1: l + 1, y1: top, x2: l + 0.5, y2: bot },
      { s: 0, x1: l + 0.5, y1: bot, x2: l, y2: top },
    ];
  }
}
