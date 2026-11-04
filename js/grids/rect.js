import { Grid } from './grid.js';

// Slots: 0 = north, 1 = east, 2 = south, 3 = west.
export class RectGrid extends Grid {
  constructor(w, h) {
    super(w * h, 4);
    this.kind = 'square';
    this.w = w;
    this.h = h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x + 1 < w) this.connect(i, 1, i + 1, 3);
        if (y + 1 < h) this.connect(i, 2, i + w, 0);
        this.cx[i] = x + 0.5;
        this.cy[i] = y + 0.5;
      }
    }
    this.bounds = { x0: 0, y0: 0, x1: w, y1: h };
  }

  edges(i) {
    const x = i % this.w;
    const y = (i - x) / this.w;
    return [
      { s: 0, x1: x, y1: y, x2: x + 1, y2: y },
      { s: 1, x1: x + 1, y1: y, x2: x + 1, y2: y + 1 },
      { s: 2, x1: x + 1, y1: y + 1, x2: x, y2: y + 1 },
      { s: 3, x1: x, y1: y + 1, x2: x, y2: y },
    ];
  }
}
