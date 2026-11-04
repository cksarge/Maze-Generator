import { mazeToSVG, svgViewBox } from './render/svg.js';

export const PAPERS = {
  letter: { label: 'US Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
  legal: { label: 'US Legal (8.5 × 14 in)', w: 215.9, h: 355.6 },
  tabloid: { label: 'Tabloid (11 × 17 in)', w: 279.4, h: 431.8 },
  a3: { label: 'A3 (297 × 420 mm)', w: 297, h: 420 },
  a4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  a5: { label: 'A5 (148 × 210 mm)', w: 148, h: 210 },
};

const HEADER_MM = 16;
const FOOTER_MM = 6;

// Computes page and maze dimensions (all in mm) for the given print options.
export function printLayout(maze, opts) {
  const paper = PAPERS[opts.paper] || PAPERS.letter;
  const vb = svgViewBox(maze.grid);
  const aspect = vb.w / vb.h;
  let landscape = opts.orientation === 'landscape';
  if (opts.orientation === 'auto') landscape = aspect > 1.15;
  const pageW = landscape ? paper.h : paper.w;
  const pageH = landscape ? paper.w : paper.h;
  const m = opts.margin;
  const header = opts.title || opts.nameLine ? HEADER_MM : 0;
  const areaW = pageW - 2 * m;
  const areaH = pageH - 2 * m - header - FOOTER_MM;
  let w = areaW;
  let h = areaW / aspect;
  if (h > areaH) {
    h = areaH;
    w = areaH * aspect;
  }
  const mmPerUnit = w / vb.w;
  return { pageW, pageH, landscape, margin: m, header, areaW, areaH, w, h, mmPerUnit, contentH: pageH - 2 * m };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function printMaze(maze, opts) {
  const L = printLayout(maze, opts);
  // Walls about 0.35 mm on paper, but never thicker than a quarter of a cell.
  const stroke = Math.min(0.25, Math.max(0.05, 0.35 / L.mmPerUnit));
  const pages = opts.content === 'both' ? [false, true] : opts.content === 'solution' ? [true] : [false];
  const seedNote = maze.params.outline === 'image' ? '' : ` · Seed ${esc(maze.params.seed)}`;

  const html = pages.map((solution) => {
    const header = L.header
      ? `<header class="pp-header">
          ${opts.title ? `<h1>${esc(opts.title)}${solution ? ' <span>(solution)</span>' : ''}</h1>` : ''}
          ${opts.nameLine && !solution ? '<div class="pp-name">Name: <span></span> Date: <span></span></div>' : ''}
        </header>`
      : '';
    const svg = mazeToSVG(maze, { solution, strokeWidth: stroke, width: `${L.w.toFixed(2)}mm`, height: `${L.h.toFixed(2)}mm` });
    return `<section class="print-page" style="width:${L.areaW.toFixed(2)}mm;height:${(L.contentH - 0.6).toFixed(2)}mm">
      ${header}
      <div class="pp-maze">${svg}</div>
      <footer class="pp-footer">${solution ? 'Solution · ' : ''}Maze Generator${seedNote} · mazegenerator.carterscoding.com</footer>
    </section>`;
  }).join('');

  const root = document.getElementById('print-root');
  root.innerHTML = html;
  let style = document.getElementById('page-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'page-style';
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${L.pageW}mm ${L.pageH}mm; margin: ${L.margin}mm; }`;
  const cleanup = () => {
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Let the browser lay out the new pages before opening the print dialog.
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}
