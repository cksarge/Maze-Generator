import { traceWalls, tracePath, allCells } from './walls.js';

const BUCKET = 2; // world units per spatial-index bucket
const OVERVIEW_THRESHOLD = 25000; // visible cells above which the cached overview is drawn
const WALL = 0.12; // wall thickness as a fraction of a cell
// Whole-maze images are drawn on a CPU-backed canvas: GPU-accelerated canvases come out
// blank, with no error, once they've been sent a few tens of millions of segments.
const WHOLE_MAZE_CANVAS = { willReadFrequently: true };

export function readColors(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const v = (name) => cs.getPropertyValue(name).trim();
  return {
    bg: v('--maze-bg'),
    wall: v('--maze-wall'),
    solution: v('--maze-solution'),
    trail: v('--maze-trail'),
    start: v('--maze-start'),
    end: v('--maze-end'),
    player: v('--maze-player'),
  };
}

// Interactive canvas view with pan/zoom, viewport culling and overlays.
export class MazeView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.maze = null;
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.dpr = 1;
    this.showSolution = false;
    this.player = null; // { trail: number[], pos }
    this.fog = null; // { radius }
    this.colors = readColors();
    this.overview = null;
    this.pending = false;
    this.pointers = new Map();
    this.mode = null;
    // Hooks set by the play controller. Return true from onDragStart to claim a drag.
    this.onDragStart = null;
    this.onDragMove = null;
    this.onDragEnd = null;

    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    // Chrome can reset canvases under heavy memory pressure; draw again when it gives them back.
    canvas.addEventListener('contextrestored', () => {
      this.overview = null;
      this.requestDraw();
    });
    this.resize();
    this._bindEvents();
  }

  setMaze(maze) {
    this.maze = maze;
    this.overview = null;
    this.player = null;
    this._buildIndex();
    this.fit();
  }

  refreshColors() {
    this.colors = readColors();
    this.overview = null;
    this.requestDraw();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    const hadSize = this.cssW;
    this.dpr = window.devicePixelRatio || 1;
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // Keep the maze fitted when the canvas changes size (e.g. the stats line below it wraps),
    // unless the user has panned or zoomed.
    if (this.maze && (!hadSize || this.fitted)) this.fit();
    this.requestDraw();
  }

  fit() {
    if (!this.maze || !this.cssW) return;
    const b = this.maze.grid.bounds;
    const pad = 0.6;
    const bw = b.x1 - b.x0 + pad * 2;
    const bh = b.y1 - b.y0 + pad * 2;
    const margin = 12;
    this.scale = Math.max(1e-4, Math.min((this.cssW - margin * 2) / bw, (this.cssH - margin * 2) / bh));
    this.fitScale = this.scale;
    this.tx = (this.cssW - bw * this.scale) / 2 - (b.x0 - pad) * this.scale;
    this.ty = (this.cssH - bh * this.scale) / 2 - (b.y0 - pad) * this.scale;
    this.fitted = true;
    this.requestDraw();
  }

  zoomAt(factor, sx = this.cssW / 2, sy = this.cssH / 2) {
    const min = (this.fitScale || 1) * 0.5;
    const max = Math.max(160, min);
    const next = Math.min(max, Math.max(min, this.scale * factor));
    const f = next / this.scale;
    this.tx = sx - (sx - this.tx) * f;
    this.ty = sy - (sy - this.ty) * f;
    this.scale = next;
    this.fitted = false;
    this.requestDraw();
  }

  toWorld(sx, sy) {
    return [(sx - this.tx) / this.scale, (sy - this.ty) / this.scale];
  }

  // Pans just enough to keep a cell away from the edges, unless the whole maze is on screen.
  ensureVisible(cell) {
    const g = this.maze.grid;
    const b = g.bounds;
    const s = this.scale;
    if (b.x0 * s + this.tx >= 0 && b.x1 * s + this.tx <= this.cssW && b.y0 * s + this.ty >= 0 && b.y1 * s + this.ty <= this.cssH) return;
    const sx = g.cx[cell] * s + this.tx;
    const sy = g.cy[cell] * s + this.ty;
    const mx = Math.min(this.cssW * 0.25, 4 * s + 20);
    const my = Math.min(this.cssH * 0.25, 4 * s + 20);
    this.fitted = false;
    if (sx < mx) this.tx += mx - sx;
    else if (sx > this.cssW - mx) this.tx -= sx - (this.cssW - mx);
    if (sy < my) this.ty += my - sy;
    else if (sy > this.cssH - my) this.ty -= sy - (this.cssH - my);
  }

  centerOn(cell, cellsAcross = 24) {
    const g = this.maze.grid;
    const target = Math.min(this.cssW, this.cssH) / cellsAcross;
    if (this.scale < target) this.scale = target;
    this.fitted = false;
    this.tx = this.cssW / 2 - g.cx[cell] * this.scale;
    this.ty = this.cssH / 2 - g.cy[cell] * this.scale;
    this.requestDraw();
  }

  requestDraw() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.draw();
    });
  }

  _buildIndex() {
    const g = this.maze.grid;
    const b = g.bounds;
    const nx = Math.ceil((b.x1 - b.x0) / BUCKET) + 1;
    const ny = Math.ceil((b.y1 - b.y0) / BUCKET) + 1;
    const start = new Int32Array(nx * ny + 1);
    const key = (c) => Math.floor((g.cy[c] - b.y0) / BUCKET) * nx + Math.floor((g.cx[c] - b.x0) / BUCKET);
    for (let j = 0; j < g.count; j++) start[key(g.cells[j]) + 1]++;
    for (let k = 0; k < nx * ny; k++) start[k + 1] += start[k];
    const fill = start.slice(0, nx * ny);
    const items = new Int32Array(g.count);
    for (let j = 0; j < g.count; j++) {
      const c = g.cells[j];
      items[fill[key(c)]++] = c;
    }
    this.index = { nx, ny, start, items };
  }

  _forBuckets(x0, y0, x1, y1, fn) {
    const { nx, ny, start, items } = this.index;
    const b = this.maze.grid.bounds;
    const bx0 = Math.max(0, Math.floor((x0 - b.x0) / BUCKET) - 1);
    const by0 = Math.max(0, Math.floor((y0 - b.y0) / BUCKET) - 1);
    const bx1 = Math.min(nx - 1, Math.floor((x1 - b.x0) / BUCKET) + 1);
    const by1 = Math.min(ny - 1, Math.floor((y1 - b.y0) / BUCKET) + 1);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const k = by * nx + bx;
        for (let t = start[k]; t < start[k + 1]; t++) fn(items[t]);
      }
    }
  }

  // Cell whose center is nearest to a world point (or -1 if none is close).
  nearestCell(x, y) {
    if (!this.maze) return -1;
    const g = this.maze.grid;
    let best = -1;
    let bd = 1.44;
    this._forBuckets(x, y, x, y, (c) => {
      const d = (g.cx[c] - x) ** 2 + (g.cy[c] - y) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    });
    return best;
  }

  _ensureOverview() {
    if (this.overview) return this.overview;
    const g = this.maze.grid;
    const b = g.bounds;
    const pad = 0.6;
    const bw = b.x1 - b.x0 + pad * 2;
    const bh = b.y1 - b.y0 + pad * 2;
    const res = Math.min(8, 4096 / Math.max(bw, bh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(bw * res));
    canvas.height = Math.max(1, Math.ceil(bh * res));
    const ctx = canvas.getContext('2d', WHOLE_MAZE_CANVAS);
    ctx.setTransform(res, 0, 0, res, -(b.x0 - pad) * res, -(b.y0 - pad) * res);
    ctx.strokeStyle = this.colors.wall;
    ctx.lineWidth = Math.max(WALL, 1 / res);
    ctx.lineCap = 'round';
    // When there are more walls than pixels, faint lines read as texture instead of a solid blob.
    ctx.globalAlpha = Math.min(1, Math.max(0.3, res * 0.5));
    traceWalls(ctx, this.maze, allCells(g));
    this.overview = { canvas, x: b.x0 - pad, y: b.y0 - pad, w: bw, h: bh };
    return this.overview;
  }

  draw() {
    const { ctx, canvas, dpr, colors } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.maze) return;
    const g = this.maze.grid;
    const s = this.scale;
    const [vx0, vy0] = this.toWorld(0, 0);
    const [vx1, vy1] = this.toWorld(this.cssW, this.cssH);
    const b = g.bounds;
    const ix = Math.max(0, Math.min(vx1, b.x1) - Math.max(vx0, b.x0));
    const iy = Math.max(0, Math.min(vy1, b.y1) - Math.max(vy0, b.y0));
    const cellArea = ((b.x1 - b.x0) * (b.y1 - b.y0)) / g.count;
    const visibleCells = (ix * iy) / cellArea;

    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * this.tx, dpr * this.ty);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (visibleCells > OVERVIEW_THRESHOLD) {
      const ov = this._ensureOverview();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ov.canvas, ov.x, ov.y, ov.w, ov.h);
    } else {
      ctx.strokeStyle = colors.wall;
      ctx.lineWidth = Math.max(WALL, 1.25 / s);
      traceWalls(ctx, this.maze, (fn) => this._forBuckets(vx0, vy0, vx1, vy1, fn));
    }

    const pathWidth = Math.max(0.28, 2 / s);
    if (this.showSolution && this.maze.solution.length) {
      ctx.strokeStyle = colors.solution;
      ctx.lineWidth = pathWidth;
      tracePath(ctx, g, this.maze.solution);
    }
    if (this.player) {
      ctx.strokeStyle = colors.trail;
      ctx.lineWidth = pathWidth;
      tracePath(ctx, g, this.player.trail);
    }

    const r = Math.max(0.3, 4 / s);
    this._dot(this.maze.start, r, colors.start);
    this._dot(this.maze.end, r, colors.end, true);
    if (this.player) this._dot(this.player.pos, r * 1.1, colors.player);

    if (this.fog && this.player) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const px = g.cx[this.player.pos] * s + this.tx;
      const py = g.cy[this.player.pos] * s + this.ty;
      const R = Math.max(8, this.fog.radius * s);
      const grad = ctx.createRadialGradient(px, py, R * 0.55, px, py, R);
      grad.addColorStop(0, hexAlpha(colors.bg, 0));
      grad.addColorStop(1, hexAlpha(colors.bg, 1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
  }

  _dot(cell, r, color, square = false) {
    const { ctx } = this;
    const g = this.maze.grid;
    const x = g.cx[cell];
    const y = g.cy[cell];
    ctx.fillStyle = color;
    ctx.beginPath();
    if (square) ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  _bindEvents() {
    const c = this.canvas;
    const local = (e) => {
      const rect = c.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    c.addEventListener('wheel', (e) => {
      if (!this.maze) return;
      e.preventDefault();
      const [sx, sy] = local(e);
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      this.zoomAt(Math.exp(-delta * 0.0015), sx, sy);
    }, { passive: false });

    c.addEventListener('pointerdown', (e) => {
      if (!this.maze) return;
      c.setPointerCapture(e.pointerId);
      const [sx, sy] = local(e);
      this.pointers.set(e.pointerId, { x: sx, y: sy });
      if (this.pointers.size === 1) {
        const [wx, wy] = this.toWorld(sx, sy);
        if (e.button === 0 && this.onDragStart && this.onDragStart(wx, wy)) this.mode = 'play';
        else this.mode = 'pan';
      } else if (this.pointers.size === 2) {
        if (this.mode === 'play' && this.onDragEnd) this.onDragEnd();
        this.mode = 'pinch';
        this._pinch = this._pinchState();
      }
    });

    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const [sx, sy] = local(e);
      const dx = sx - p.x;
      const dy = sy - p.y;
      p.x = sx;
      p.y = sy;
      if (this.mode === 'pan') {
        if (dx || dy) this.fitted = false;
        this.tx += dx;
        this.ty += dy;
        this.requestDraw();
      } else if (this.mode === 'play') {
        const [wx, wy] = this.toWorld(sx, sy);
        this.onDragMove?.(wx, wy);
      } else if (this.mode === 'pinch') {
        const next = this._pinchState();
        this.fitted = false;
        this.tx += next.mx - this._pinch.mx;
        this.ty += next.my - this._pinch.my;
        if (this._pinch.d > 0) this.zoomAt(next.d / this._pinch.d, next.mx, next.my);
        this._pinch = next;
        this.requestDraw();
      }
    });

    const up = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.mode === 'play' && this.onDragEnd) this.onDragEnd();
      if (this.pointers.size === 1) {
        this.mode = 'pan';
      } else if (this.pointers.size === 0) {
        this.mode = null;
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }

  _pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  }
}

function hexAlpha(color, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return alpha ? color : 'rgba(0,0,0,0)';
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Renders a whole maze to a new canvas (used for PNG download and print preview).
export function renderMazeImage(maze, { pxPerUnit = 16, maxPx = 8192, solution = false, colors, background = true } = {}) {
  const g = maze.grid;
  const b = g.bounds;
  const pad = 0.6;
  const bw = b.x1 - b.x0 + pad * 2;
  const bh = b.y1 - b.y0 + pad * 2;
  const res = Math.min(pxPerUnit, maxPx / Math.max(bw, bh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(bw * res));
  canvas.height = Math.max(1, Math.ceil(bh * res));
  const ctx = canvas.getContext('2d', WHOLE_MAZE_CANVAS);
  if (background) {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(res, 0, 0, res, -(b.x0 - pad) * res, -(b.y0 - pad) * res);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colors.wall;
  ctx.lineWidth = Math.max(WALL, 1 / res);
  traceWalls(ctx, maze, allCells(g));
  if (solution && maze.solution.length) {
    ctx.strokeStyle = colors.solution;
    ctx.lineWidth = Math.max(0.28, 1.5 / res);
    tracePath(ctx, g, maze.solution);
  }
  const r = Math.max(0.3, 2 / res);
  ctx.fillStyle = colors.start;
  ctx.beginPath();
  ctx.arc(g.cx[maze.start], g.cy[maze.start], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.end;
  ctx.fillRect(g.cx[maze.end] - r * 0.85, g.cy[maze.end] - r * 0.85, r * 1.7, r * 1.7);
  return canvas;
}
