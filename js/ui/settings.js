import { ALGORITHMS, getAlgorithm } from '../algorithms/index.js';
import { MASKS } from '../grids/masks.js';
import { estimateCells, isPlainRect } from '../grids/build.js';
import { DIFFICULTY_LABELS, clampDifficulty } from '../difficulty.js';
import { ImageMask } from './image-mask.js';

export const WARN_CELLS = 250_000;
export const CONFIRM_CELLS = 2_000_000;

const $ = (id) => document.getElementById(id);

const PRESETS = {
  square: { rect: [[8, 8], [15, 15], [25, 25], [50, 50], [150, 150]] },
  hex: { rect: [[7, 6], [12, 10], [20, 16], [40, 32], [110, 90]], natural: [4, 7, 12, 22, 60] },
  tri: { rect: [[12, 6], [22, 10], [36, 17], [70, 34], [180, 88]], natural: [6, 10, 18, 34, 90] },
  polar: { rings: [5, 9, 15, 28, 80] },
};
const MASK_WIDTHS = [12, 20, 34, 70, 160];
const PRESET_KEYS = ['xs', 's', 'm', 'l', 'xl'];

// Height (in cells) that gives a grid of width w the requested width/height ratio.
export function heightForAspect(cellType, w, aspect) {
  let h;
  if (cellType === 'hex') h = (1.5 * w + 0.5) / aspect / Math.sqrt(3) - 0.5;
  else if (cellType === 'tri') h = (w + 1) / 2 / aspect / (Math.sqrt(3) / 2);
  else h = w / aspect;
  return Math.max(2, Math.round(h));
}

export function formatBytes(b) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}

export class Settings {
  constructor({ onChange, onImageError }) {
    this.onChange = onChange;
    this.form = $('settings-form');
    this.outline = $('outline');
    this.algo = $('algo');

    this.image = new ImageMask({
      file: $('image-file'),
      label: $('image-file-label'),
      threshold: $('threshold'),
      thresholdOut: $('threshold-out'),
      invert: $('invert'),
      preview: $('image-preview'),
      onChange: (e) => {
        if (e.error) return onImageError?.(e.error);
        if (e.fresh) this.matchImageAspect();
        if (e.empty) onImageError?.('No part of the image is inside the shape. Adjust the threshold or try Invert.');
        this.refresh();
      },
    });

    for (const a of ALGORITHMS) {
      const o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.name;
      this.algo.append(o);
    }

    this.form.querySelectorAll('input[name="cellType"]').forEach((r) => r.addEventListener('change', () => {
      this._fillOutlines();
      this.refresh();
    }));
    this.outline.addEventListener('change', () => {
      if (this.outline.value !== 'rect' && this.outline.value !== 'natural' && this.outline.value !== 'image') this._squareUp();
      this.refresh();
    });
    for (const id of ['w', 'h', 'size', 'rings', 'algo', 'placement', 'edge-only']) $(id).addEventListener('input', () => this.refresh());
    $('difficulty').addEventListener('input', () => {
      $('difficulty-num').value = $('difficulty').value;
      this.refresh();
    });
    $('difficulty-num').addEventListener('input', () => {
      const v = $('difficulty-num').value;
      if (v !== '') $('difficulty').value = clampDifficulty(v);
      this.refresh();
    });
    $('difficulty-num').addEventListener('change', () => {
      $('difficulty-num').value = clampDifficulty($('difficulty-num').value);
    });
    $('seed').addEventListener('input', () => {
      $('seed-keep').checked = true;
    });
    $('match-aspect').addEventListener('click', () => this.matchImageAspect());
    $('size-presets').addEventListener('click', (e) => {
      const key = e.target.closest('button')?.dataset.preset;
      if (key) this.applyPreset(PRESET_KEYS.indexOf(key));
    });

    this._fillOutlines();
    this.refresh();
  }

  get cellType() {
    return this.form.querySelector('input[name="cellType"]:checked').value;
  }

  set cellType(v) {
    const r = this.form.querySelector(`input[name="cellType"][value="${v}"]`);
    if (r) r.checked = true;
  }

  _fillOutlines() {
    const ct = this.cellType;
    const prev = this.outline.value;
    this.outline.innerHTML = '';
    const add = (value, label) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      this.outline.append(o);
    };
    if (ct === 'hex') add('natural', 'Hexagon');
    if (ct === 'tri') add('natural', 'Triangle');
    add('rect', 'Rectangle');
    for (const [k, m] of Object.entries(MASKS)) add(k, m.label);
    add('image', 'Custom image…');
    if ([...this.outline.options].some((o) => o.value === prev)) this.outline.value = prev;
  }

  // Makes the grid roughly square so preset silhouettes fill it well.
  _squareUp() {
    const w = Number($('w').value) || 20;
    $('h').value = heightForAspect(this.cellType, w, 1);
  }

  matchImageAspect() {
    if (!this.image.mask) return;
    const w = Number($('w').value) || 30;
    $('h').value = heightForAspect(this.cellType, w, this.image.aspect);
    this.refresh();
  }

  applyPreset(k) {
    const ct = this.cellType;
    const o = this.outline.value;
    if (ct === 'polar') $('rings').value = PRESETS.polar.rings[k];
    else if (o === 'natural') $('size').value = PRESETS[ct].natural[k];
    else if (o === 'rect') {
      [$('w').value, $('h').value] = PRESETS[ct].rect[k];
    } else {
      $('w').value = MASK_WIDTHS[k];
      $('h').value = heightForAspect(ct, MASK_WIDTHS[k], o === 'image' && this.image.mask ? this.image.aspect : 1);
    }
    this.refresh();
  }

  // Reads the form into a params object. Throws an Error with a friendly message.
  read() {
    const int = (id, label, min = 2) => {
      const v = Number($(id).value);
      if (!Number.isFinite(v) || !Number.isInteger(v) || v < min) throw new Error(`${label} must be a whole number of at least ${min}.`);
      return v;
    };
    const ct = this.cellType;
    const o = ct === 'polar' ? 'circle' : this.outline.value;
    const p = {
      cellType: ct,
      outline: o,
      difficulty: clampDifficulty($('difficulty').value),
      algo: this.algo.value,
      placement: $('placement').value,
      openings: $('openings').checked,
      edgeOnly: $('edge-only').checked,
      seed: $('seed').value.trim(),
    };
    if (ct === 'polar') p.rings = int('rings', 'Rings');
    else if (o === 'natural') p.size = int('size', 'Size');
    else {
      p.w = int('w', 'Width');
      p.h = int('h', 'Height');
    }
    if (o === 'image' && ct !== 'polar' && !this.image.mask) throw new Error('Choose an image to use as the maze shape first.');
    return p;
  }

  write(p) {
    if (p.cellType) this.cellType = p.cellType;
    this._fillOutlines();
    if (p.outline && [...this.outline.options].some((x) => x.value === p.outline)) this.outline.value = p.outline;
    if (p.w) $('w').value = p.w;
    if (p.h) $('h').value = p.h;
    if (p.size) $('size').value = p.size;
    if (p.rings) $('rings').value = p.rings;
    if (p.difficulty) {
      $('difficulty').value = clampDifficulty(p.difficulty);
      $('difficulty-num').value = clampDifficulty(p.difficulty);
    }
    if (p.algo && ALGORITHMS.some((a) => a.id === p.algo)) this.algo.value = p.algo;
    if (p.placement) $('placement').value = p.placement;
    if (p.openings !== undefined) $('openings').checked = p.openings;
    if (p.edgeOnly !== undefined) $('edge-only').checked = p.edgeOnly;
    if (p.seed) $('seed').value = p.seed;
    this.refresh();
  }

  setSeed(seed) {
    $('seed').value = seed;
  }

  get keepSeed() {
    return $('seed-keep').checked;
  }

  // Updates which fields are visible, algorithm availability and size warnings.
  refresh() {
    const ct = this.cellType;
    const o = this.outline.value;
    const polar = ct === 'polar';
    $('outline-field').hidden = polar;
    $('image-section').hidden = polar || o !== 'image';
    $('wh-fields').hidden = polar || o === 'natural';
    $('size-field').hidden = polar || o !== 'natural';
    $('rings-field').hidden = !polar;
    $('size-label').textContent = ct === 'tri' ? 'Rows' : 'Cells per side';

    const d = clampDifficulty($('difficulty').value);
    $('difficulty-label').textContent = `${d} · ${DIFFICULTY_LABELS[d - 1]}`;

    const plain = isPlainRect({ cellType: ct, outline: polar ? 'circle' : o });
    for (const opt of this.algo.options) {
      const a = getAlgorithm(opt.value);
      opt.disabled = a.rectOnly && !plain;
      opt.textContent = a.rectOnly && !plain ? `${a.name} (rectangle of squares only)` : a.name;
    }
    if (this.algo.selectedOptions[0]?.disabled) this.algo.value = 'growing-tree';

    // Placements that can put an end inside the maze are unavailable when ends must be on the edge.
    const edgeOnly = $('edge-only').checked;
    const placement = $('placement');
    for (const opt of placement.options) opt.disabled = edgeOnly && (opt.value === 'center' || opt.value === 'farthest');
    if (placement.selectedOptions[0]?.disabled) placement.value = 'edges';
    $('algo-desc').textContent = getAlgorithm(this.algo.value).desc;

    this._sizeInfo();
    this.onChange?.();
  }

  estimate() {
    const ct = this.cellType;
    const p = {
      cellType: ct,
      outline: ct === 'polar' ? 'circle' : this.outline.value,
      w: Number($('w').value) || 0,
      h: Number($('h').value) || 0,
      size: Number($('size').value) || 0,
      rings: Number($('rings').value) || 0,
    };
    const { cells, D } = estimateCells(p);
    return { cells, bytes: cells * (D * 5 + 70) };
  }

  _sizeInfo() {
    const { cells, bytes } = this.estimate();
    const masked = !['rect', 'natural'].includes(this.outline.value) && this.cellType !== 'polar';
    $('size-info').textContent = `${masked ? 'Up to ' : ''}${cells.toLocaleString()} cells · about ${formatBytes(bytes)} of memory`;
    const warn = $('size-warning');
    const algo = getAlgorithm(this.algo.value);
    let msg = '';
    if (cells > CONFIRM_CELLS) msg = 'Very large maze: this may take a long time, use a lot of memory, or crash the tab on some devices.';
    else if (cells > WARN_CELLS) msg = 'Large maze: generating and drawing may be slow on phones and older computers.';
    if (algo.slow && cells > 100_000) msg += `${msg ? ' ' : ''}Aldous-Broder is extremely slow at this size; Wilson's makes the same kind of maze much faster.`;
    warn.hidden = !msg;
    warn.textContent = msg;
    warn.classList.toggle('severe', cells > CONFIRM_CELLS);
  }

  toQuery(p) {
    const q = new URLSearchParams();
    q.set('ct', p.cellType);
    if (p.cellType !== 'polar') q.set('o', p.outline);
    if (p.w) q.set('w', p.w);
    if (p.h) q.set('h', p.h);
    if (p.size) q.set('s', p.size);
    if (p.rings) q.set('r', p.rings);
    q.set('d', p.difficulty);
    q.set('a', p.algo);
    q.set('p', p.placement);
    q.set('op', p.openings ? 1 : 0);
    q.set('eo', p.edgeOnly ? 1 : 0);
    q.set('seed', p.seed);
    return q.toString();
  }

  static fromQuery(search) {
    const q = new URLSearchParams(search);
    if (!q.has('seed')) return null;
    const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined);
    return {
      cellType: q.get('ct') || 'square',
      outline: q.get('o') || undefined,
      w: num('w'),
      h: num('h'),
      size: num('s'),
      rings: num('r'),
      difficulty: num('d'),
      algo: q.get('a') || undefined,
      placement: q.get('p') || undefined,
      openings: q.has('op') ? q.get('op') === '1' : undefined,
      edgeOnly: q.has('eo') ? q.get('eo') === '1' : undefined,
      seed: q.get('seed'),
    };
  }
}
