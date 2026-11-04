// Play mode: move from start to finish with keyboard or drag, timed.

const KEYS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1], '8': [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1], '2': [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], '4': [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0], '6': [1, 0],
  q: [-1, -1], Q: [-1, -1], '7': [-1, -1], Home: [-1, -1],
  e: [1, -1], E: [1, -1], '9': [1, -1], PageUp: [1, -1],
  z: [-1, 1], Z: [-1, 1], '1': [-1, 1], End: [-1, 1],
  c: [1, 1], C: [1, 1], '3': [1, 1], PageDown: [1, 1],
};

export function formatTime(ms) {
  const t = Math.max(0, ms) / 1000;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export class Game {
  constructor(view, { onTick, onWin }) {
    this.view = view;
    this.onTick = onTick;
    this.onWin = onWin;
    this.active = false;
    this._timer = null;
    this._onKey = (e) => this._key(e);
    view.onDragStart = (x, y) => this._dragStart(x, y);
    view.onDragMove = (x, y) => this._dragMove(x, y);
    view.onDragEnd = () => {
      this.dragging = false;
    };
  }

  start(maze, { fog = false, fogRadius = 5 } = {}) {
    this.maze = maze;
    this.active = true;
    this.fogOn = fog;
    this.fogRadius = fogRadius;
    this.trailIndex = new Int32Array(maze.grid.n).fill(-1);
    window.addEventListener('keydown', this._onKey);
    this.restart();
  }

  restart() {
    const { maze, view } = this;
    this._stopTimer();
    this.trailIndex.fill(-1);
    this.trail = [maze.start];
    this.trailIndex[maze.start] = 0;
    this.pos = maze.start;
    this.moves = 0;
    this.t0 = null;
    this.elapsed = 0;
    this.finished = false;
    this.gaveUp = false;
    this.lastDir = [0, 0];
    view.showSolution = false;
    view.player = { trail: this.trail, pos: this.pos };
    view.fog = this.fogOn ? { radius: this.fogRadius } : null;
    // Zoom in on the player when the whole maze would be too small to play comfortably.
    view.fit();
    if (view.scale < 14 || this.fogOn) view.centerOn(this.pos);
    view.requestDraw();
    this._tick();
  }

  setFog(on, radius = this.fogRadius) {
    this.fogOn = on;
    this.fogRadius = radius;
    if (!this.active) return;
    this.view.fog = on && !this.finished ? { radius } : null;
    if (on) this.view.centerOn(this.pos);
    this.view.requestDraw();
  }

  exit() {
    this.active = false;
    this._stopTimer();
    window.removeEventListener('keydown', this._onKey);
    this.view.player = null;
    this.view.fog = null;
    this.view.requestDraw();
  }

  giveUp() {
    if (!this.active || this.finished) return;
    this.finished = true;
    this.gaveUp = true;
    this._stopTimer();
    this.view.showSolution = true;
    this.view.fog = null;
    this.view.requestDraw();
    this._tick();
  }

  _now() {
    return this.t0 === null ? 0 : performance.now() - this.t0;
  }

  _tick() {
    this.onTick?.({ time: this.finished ? this.elapsed : this._now(), moves: this.moves, finished: this.finished, gaveUp: this.gaveUp });
  }

  _stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  // Moves one step to an adjacent cell through an open passage.
  _step(nb) {
    if (this.finished) return false;
    const g = this.maze.grid;
    const s = g.slotTo(this.pos, nb);
    if (s < 0 || !g.linked(this.pos, s)) return false;
    if (this.t0 === null) {
      this.t0 = performance.now();
      this._timer = setInterval(() => this._tick(), 100);
    }
    this.lastDir = [g.cx[nb] - g.cx[this.pos], g.cy[nb] - g.cy[this.pos]];
    const k = this.trailIndex[nb];
    if (k >= 0) {
      // Stepping back onto the trail erases the loop.
      for (let j = k + 1; j < this.trail.length; j++) this.trailIndex[this.trail[j]] = -1;
      this.trail.length = k + 1;
    } else {
      this.trailIndex[nb] = this.trail.length;
      this.trail.push(nb);
    }
    this.pos = nb;
    this.moves++;
    this.view.player.pos = nb;
    if (nb === this.maze.end) this._win();
    return true;
  }

  _afterMove() {
    this.view.ensureVisible(this.pos);
    this.view.requestDraw();
    this._tick();
  }

  move(dx, dy) {
    if (!this.active || this.finished) return;
    const g = this.maze.grid;
    const { D, nbr } = g;
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    let best = -1;
    let bestDot = 0.35;
    let bestTie = -Infinity;
    for (let s = 0; s < D; s++) {
      if (!g.linked(this.pos, s)) continue;
      const nb = nbr[this.pos * D + s];
      let vx = g.cx[nb] - g.cx[this.pos];
      let vy = g.cy[nb] - g.cy[this.pos];
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      const dot = vx * dx + vy * dy;
      const tie = vx * this.lastDir[0] + vy * this.lastDir[1];
      if (dot > bestDot + 0.01 || (Math.abs(dot - bestDot) <= 0.01 && tie > bestTie)) {
        best = nb;
        bestDot = Math.max(dot, bestDot);
        bestTie = tie;
      }
    }
    if (best >= 0 && this._step(best)) this._afterMove();
  }

  _key(e) {
    if (!this.active) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    this.move(dir[0], dir[1]);
  }

  _dragStart(x, y) {
    if (!this.active || this.finished) return false;
    const c = this.view.nearestCell(x, y);
    if (c < 0) return false;
    const g = this.maze.grid;
    const near = Math.hypot(g.cx[this.pos] - x, g.cy[this.pos] - y) < 1.6;
    if (!near && this.trailIndex[c] < 0) return false;
    this.dragging = true;
    this._dragMove(x, y);
    return true;
  }

  _dragMove(x, y) {
    if (!this.dragging || this.finished) return;
    const target = this.view.nearestCell(x, y);
    if (target < 0 || target === this.pos) return;
    const path = this._shortPath(this.pos, target, 10);
    if (!path) return;
    for (const c of path) if (!this._step(c)) break;
    this._afterMove();
  }

  // Short BFS through open passages, so fast drags still follow the corridors.
  _shortPath(from, to, maxDepth) {
    const g = this.maze.grid;
    const { D, nbr } = g;
    const prev = new Map([[from, -1]]);
    let frontier = [from];
    for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
      const next = [];
      for (const c of frontier) {
        for (let s = 0; s < D; s++) {
          if (!g.linked(c, s)) continue;
          const nb = nbr[c * D + s];
          if (prev.has(nb)) continue;
          prev.set(nb, c);
          if (nb === to) {
            const path = [];
            for (let p = to; p !== from; p = prev.get(p)) path.push(p);
            return path.reverse();
          }
          next.push(nb);
        }
      }
      frontier = next;
    }
    return null;
  }

  _win() {
    this.finished = true;
    this.elapsed = this._now();
    this._stopTimer();
    this.view.fog = null;
    this.onWin?.({ time: this.elapsed, moves: this.moves, optimal: this.maze.solution.length - 1 });
  }
}
