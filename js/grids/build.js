import { RectGrid } from './rect.js';
import { HexGrid } from './hex.js';
import { TriGrid } from './triangle.js';
import { PolarGrid, polarRingCounts } from './polar.js';
import { maskCellTest } from './masks.js';

// Builds the grid described by the maze parameters. This is deterministic, so the
// worker and the main thread can each build the same grid from the same params.
export function buildGrid(p, image) {
  let g;
  switch (p.cellType) {
    case 'hex':
      g = p.outline === 'natural' ? HexGrid.hexagon(p.size) : HexGrid.rect(p.w, p.h);
      break;
    case 'tri':
      g = p.outline === 'natural' ? TriGrid.triangle(p.size) : new TriGrid(p.w, p.h, 0);
      break;
    case 'polar':
      g = new PolarGrid(p.rings);
      break;
    default:
      g = new RectGrid(p.w, p.h);
  }
  let test = null;
  if (g.naturalTest) test = g.naturalTest;
  else if (p.cellType !== 'polar' && p.outline !== 'rect' && p.outline !== 'natural') test = maskCellTest(g, p.outline, image);
  return g.finalize(test);
}

// Number of cells (before masking) and max neighbors, for size warnings.
export function estimateCells(p) {
  switch (p.cellType) {
    case 'hex':
      if (p.outline === 'natural') {
        const R = p.size - 1;
        return { cells: 3 * R * R + 3 * R + 1, D: 6 };
      }
      return { cells: p.w * p.h, D: 6 };
    case 'tri':
      return { cells: p.outline === 'natural' ? p.size * p.size : p.w * p.h, D: 3 };
    case 'polar':
      return { cells: p.rings > 0 ? polarRingCounts(Math.min(p.rings, 200000)).reduce((a, b) => a + b, 0) : 0, D: 6 };
    default:
      return { cells: p.w * p.h, D: 4 };
  }
}

// True when the grid is a plain, unmasked rectangle of squares.
export function isPlainRect(p) {
  return p.cellType === 'square' && p.outline === 'rect';
}
