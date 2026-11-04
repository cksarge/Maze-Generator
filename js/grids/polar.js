import { Grid } from './grid.js';

// Circular maze: a center cell surrounded by rings of unit thickness. Rings subdivide
// as they grow so cells stay roughly square.
// Slots for the center cell: 0..5 = the cells of ring 1.
// Slots for other cells: 0 = clockwise, 1 = counter-clockwise, 2 = inward, 3+ = outward.
const TAU = Math.PI * 2;

export function polarRingCounts(rings) {
  const counts = [1];
  for (let r = 1; r < rings; r++) {
    const prev = counts[r - 1];
    const ratio = Math.max(1, Math.round((TAU * r) / prev));
    counts.push(prev * ratio);
  }
  return counts;
}

export class PolarGrid extends Grid {
  constructor(rings) {
    const counts = polarRingCounts(rings);
    let maxRatio = 1;
    for (let r = 2; r < rings; r++) maxRatio = Math.max(maxRatio, counts[r] / counts[r - 1]);
    const offsets = [0];
    for (let r = 1; r < rings; r++) offsets.push(offsets[r - 1] + counts[r - 1]);
    const n = offsets[rings - 1] + counts[rings - 1];
    super(n, Math.max(rings > 1 ? counts[1] : 1, 3 + maxRatio));
    this.kind = 'polar';
    this.rings = rings;
    this.counts = counts;
    this.offsets = offsets;
    this.ringOf = new Uint16Array(n);
    const C = rings;
    this.cx[0] = C;
    this.cy[0] = C;
    for (let r = 1; r < rings; r++) {
      const c = counts[r];
      const ratio = c / counts[r - 1];
      for (let k = 0; k < c; k++) {
        const i = offsets[r] + k;
        this.ringOf[i] = r;
        this.connect(i, 0, offsets[r] + ((k + 1) % c), 1);
        const parent = offsets[r - 1] + Math.floor(k / ratio);
        const j = k % ratio;
        this.connect(i, 2, parent, r === 1 ? j : 3 + j);
        const a = (TAU * (k + 0.5)) / c;
        this.cx[i] = C + (r + 0.5) * Math.cos(a);
        this.cy[i] = C + (r + 0.5) * Math.sin(a);
      }
    }
    this.bounds = { x0: 0, y0: 0, x1: 2 * C, y1: 2 * C };
  }

  _arc(s, r, a1, a2) {
    const C = this.rings;
    return {
      s, arc: true, cx: C, cy: C, r, a1, a2,
      x1: C + r * Math.cos(a1), y1: C + r * Math.sin(a1),
      x2: C + r * Math.cos(a2), y2: C + r * Math.sin(a2),
    };
  }

  edges(i) {
    const C = this.rings;
    if (i === 0) {
      if (this.rings === 1) return [this._arc(-1, 1, 0, TAU)];
      const c1 = this.counts[1];
      const out = [];
      for (let k = 0; k < c1; k++) out.push(this._arc(k, 1, (TAU * k) / c1, (TAU * (k + 1)) / c1));
      return out;
    }
    const r = this.ringOf[i];
    const c = this.counts[r];
    const k = i - this.offsets[r];
    const a1 = (TAU * k) / c;
    const a2 = (TAU * (k + 1)) / c;
    const out = [this._arc(2, r, a1, a2)];
    out.push({ s: 0, x1: C + r * Math.cos(a2), y1: C + r * Math.sin(a2), x2: C + (r + 1) * Math.cos(a2), y2: C + (r + 1) * Math.sin(a2) });
    if (r < this.rings - 1) {
      const q = this.counts[r + 1] / c;
      for (let j = 0; j < q; j++) out.push(this._arc(3 + j, r + 1, a1 + ((a2 - a1) * j) / q, a1 + ((a2 - a1) * (j + 1)) / q));
    } else {
      out.push(this._arc(-1, r + 1, a1, a2));
    }
    out.push({ s: 1, x1: C + (r + 1) * Math.cos(a1), y1: C + (r + 1) * Math.sin(a1), x2: C + r * Math.cos(a1), y2: C + r * Math.sin(a1) });
    return out;
  }
}
