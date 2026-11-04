// Shape masks. Each test takes normalized coordinates (u, v) in [0, 1] and returns true
// when that point is inside the shape.

function polygonTest(points) {
  return (u, v) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

function starPoints(spikes, outer, inner) {
  const pts = [];
  for (let k = 0; k < spikes * 2; k++) {
    const r = k % 2 ? inner : outer;
    const a = -Math.PI / 2 + (Math.PI * k) / spikes;
    pts.push([0.5 + r * Math.cos(a), 0.52 + r * Math.sin(a)]);
  }
  return pts;
}

export const MASKS = {
  circle: { label: 'Circle', test: (u, v) => (u - 0.5) ** 2 + (v - 0.5) ** 2 <= 0.25 },
  ring: {
    label: 'Ring (donut)',
    test: (u, v) => {
      const d = (u - 0.5) ** 2 + (v - 0.5) ** 2;
      return d <= 0.25 && d >= 0.04;
    },
  },
  heart: {
    label: 'Heart',
    test: (u, v) => {
      const x = (u - 0.5) * 2.4;
      const y = 1.3 - v * 2.35;
      const a = x * x + y * y - 1;
      return a * a * a - x * x * y * y * y <= 0;
    },
  },
  star: { label: 'Star', test: polygonTest(starPoints(5, 0.5, 0.21)) },
  diamond: { label: 'Diamond', test: (u, v) => Math.abs(u - 0.5) + Math.abs(v - 0.5) <= 0.5 },
  cross: {
    label: 'Cross',
    test: (u, v) => (Math.abs(u - 0.5) <= 0.17 && v >= 0 && v <= 1) || (Math.abs(v - 0.5) <= 0.17 && u >= 0 && u <= 1),
  },
  hourglass: {
    label: 'Hourglass',
    test: (u, v) => Math.abs(u - 0.5) <= Math.abs(v - 0.5) + 0.06 && v >= 0 && v <= 1,
  },
  arrow: {
    label: 'Arrow',
    test: polygonTest([[0, 0.35], [0.55, 0.35], [0.55, 0.1], [1, 0.5], [0.55, 0.9], [0.55, 0.65], [0, 0.65]]),
  },
};

// Builds a per-cell test for a grid. Presets keep their aspect ratio (fit in a centered
// square); image masks stretch to fill the grid's bounds.
export function maskCellTest(grid, name, image) {
  const b = grid.bounds;
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  if (name === 'image') {
    if (!image) throw new Error('Upload an image to use as the maze shape.');
    const { data, w, h } = image;
    return (i) => {
      const u = (grid.cx[i] - b.x0) / bw;
      const v = (grid.cy[i] - b.y0) / bh;
      const px = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
      return data[py * w + px] === 1;
    };
  }
  const mask = MASKS[name];
  if (!mask) return null;
  const S = Math.max(bw, bh);
  const mx = (b.x0 + b.x1) / 2;
  const my = (b.y0 + b.y1) / 2;
  return (i) => mask.test((grid.cx[i] - mx) / S + 0.5, (grid.cy[i] - my) / S + 0.5);
}
