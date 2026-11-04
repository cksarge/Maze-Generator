import { forEachWall, allCells } from './walls.js';

const PAD = 0.6;
const r3 = (v) => Math.round(v * 1000) / 1000;

export const PRINT_COLORS = {
  wall: '#000000',
  solution: '#d6336c',
  start: '#1f9d55',
  end: '#d6336c',
};

export function svgViewBox(grid) {
  const b = grid.bounds;
  return { x: b.x0 - PAD, y: b.y0 - PAD, w: b.x1 - b.x0 + PAD * 2, h: b.y1 - b.y0 + PAD * 2 };
}

// Builds a standalone SVG string for a maze. width/height are SVG length strings
// (e.g. "180mm"); when omitted the SVG scales to its container.
export function mazeToSVG(maze, { solution = false, strokeWidth = 0.12, colors = PRINT_COLORS, width, height, background } = {}) {
  const g = maze.grid;
  const vb = svgViewBox(g);
  const d = [];
  forEachWall(maze, allCells(g), (e) => {
    if (e.arc) {
      const large = e.a2 - e.a1 > Math.PI ? 1 : 0;
      if (e.a2 - e.a1 >= Math.PI * 2 - 1e-9) {
        // Full circle: two half arcs.
        const mx = e.cx - e.r;
        d.push(`M${r3(e.cx + e.r)} ${r3(e.cy)}A${r3(e.r)} ${r3(e.r)} 0 1 1 ${r3(mx)} ${r3(e.cy)}A${r3(e.r)} ${r3(e.r)} 0 1 1 ${r3(e.cx + e.r)} ${r3(e.cy)}`);
      } else {
        d.push(`M${r3(e.x1)} ${r3(e.y1)}A${r3(e.r)} ${r3(e.r)} 0 ${large} 1 ${r3(e.x2)} ${r3(e.y2)}`);
      }
    } else {
      d.push(`M${r3(e.x1)} ${r3(e.y1)}L${r3(e.x2)} ${r3(e.y2)}`);
    }
  });

  const size = width && height ? ` width="${width}" height="${height}"` : '';
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r3(vb.x)} ${r3(vb.y)} ${r3(vb.w)} ${r3(vb.h)}"${size} preserveAspectRatio="xMidYMid meet">`,
  ];
  if (background) parts.push(`<rect x="${r3(vb.x)}" y="${r3(vb.y)}" width="${r3(vb.w)}" height="${r3(vb.h)}" fill="${background}"/>`);
  parts.push(`<path d="${d.join('')}" fill="none" stroke="${colors.wall}" stroke-width="${r3(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (solution && maze.solution.length) {
    const pts = [];
    for (const c of maze.solution) pts.push(`${r3(g.cx[c])},${r3(g.cy[c])}`);
    parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${colors.solution}" stroke-width="${r3(Math.max(strokeWidth * 2, 0.22))}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`);
  }
  const mr = 0.3;
  parts.push(`<circle cx="${r3(g.cx[maze.start])}" cy="${r3(g.cy[maze.start])}" r="${mr}" fill="${colors.start}"/>`);
  parts.push(`<rect x="${r3(g.cx[maze.end] - mr * 0.85)}" y="${r3(g.cy[maze.end] - mr * 0.85)}" width="${r3(mr * 1.7)}" height="${r3(mr * 1.7)}" fill="${colors.end}"/>`);
  parts.push('</svg>');
  return parts.join('');
}
