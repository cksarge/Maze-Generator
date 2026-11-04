import { MazeView, renderMazeImage, readColors } from './render/canvas.js';
import { mazeSVGParts, PRINT_COLORS, svgViewBox } from './render/svg.js';
import { runGeneration, assembleMaze } from './generate.js';
import { getAlgorithm } from './algorithms/index.js';
import { randomSeed } from './rng.js';
import { Settings, CONFIRM_CELLS, formatBytes } from './ui/settings.js';
import { Game, formatTime } from './play.js';
import { PAPERS, printLayout, printMaze } from './print.js';

const $ = (id) => document.getElementById(id);

const state = {
  maze: null,
  worker: null,
  job: null,
  jobId: 0,
  playing: false,
};

// ---------- Toast ----------
let toastTimer;
function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- View, settings, game ----------
const view = new MazeView($('maze-canvas'));
const settings = new Settings({ onImageError: (m) => toast(m, 5000) });
const game = new Game(view, {
  onTick: ({ time, moves, finished, gaveUp }) => {
    $('hud-time').textContent = formatTime(time);
    $('hud-moves').textContent = moves;
    $('giveup-btn').disabled = finished;
    if (gaveUp) $('hud-time').textContent += ' (gave up)';
  },
  onWin: (r) => showWin(r),
});

// ---------- Generation (in a Web Worker when possible) ----------
function getWorker() {
  if (state.worker) return state.worker;
  try {
    const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const job = state.job;
      const msg = e.data;
      if (!job || msg.id !== job.id) return;
      if (msg.type === 'progress') setProgress(msg.p);
      else if (msg.type === 'done') job.resolve(msg.result);
      else if (msg.type === 'error') job.reject(new Error(msg.message));
    };
    w.onerror = (e) => {
      e.preventDefault();
      // Module workers are unsupported or failed to load: fall back to this thread.
      w.terminate();
      state.worker = false;
      const job = state.job;
      if (job) runLocally(job);
    };
    state.worker = w;
  } catch {
    state.worker = false;
  }
  return state.worker;
}

function runLocally(job) {
  setTimeout(() => {
    try {
      job.resolve(runGeneration(job.params, job.image));
    } catch (err) {
      job.reject(err instanceof RangeError ? new Error('Your device ran out of memory for a maze this large. Try a smaller size.') : err);
    }
  }, 30);
}

function runJob(params, image) {
  return new Promise((resolve, reject) => {
    const job = { id: ++state.jobId, params, image, resolve, reject };
    state.job = job;
    const w = getWorker();
    if (w) w.postMessage({ id: job.id, params, image });
    else runLocally(job);
  });
}

function cancelJob() {
  if (!state.job) return;
  if (state.worker) state.worker.terminate();
  state.worker = null;
  state.job.reject(new Error('cancelled'));
  state.job = null;
}

let busyTimer;
function setBusy(on, text = 'Generating…') {
  $('generate').disabled = on;
  $('progress').hidden = !on;
  clearTimeout(busyTimer);
  if (on) {
    setProgress(0);
    $('busy-text').textContent = text;
    busyTimer = setTimeout(() => {
      $('busy').hidden = false;
    }, 150);
  } else {
    $('busy').hidden = true;
  }
}

function setProgress(p) {
  $('progress-bar').value = p;
  $('busy-text').textContent = `Generating… ${Math.round(p * 100)}%`;
}

function confirmDialog(text) {
  return new Promise((resolve) => {
    const d = $('confirm-dialog');
    $('confirm-text').textContent = text;
    d.returnValue = 'cancel';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

async function generate({ newSeed = true } = {}) {
  if (state.job) return;
  if (state.playing) exitPlay();
  let params;
  try {
    if (newSeed && !settings.keepSeed) settings.setSeed(randomSeed());
    if (!document.getElementById('seed').value.trim()) settings.setSeed(randomSeed());
    params = settings.read();
  } catch (err) {
    toast(err.message, 5000);
    return;
  }
  const { cells, bytes } = settings.estimate();
  if (cells > CONFIRM_CELLS) {
    const ok = await confirmDialog(
      `This maze has about ${cells.toLocaleString()} cells and needs roughly ${formatBytes(bytes)} of memory. ` +
      'It could take a while, and on some devices the tab may freeze or crash.',
    );
    if (!ok) return;
  }
  const image = params.outline === 'image' && params.cellType !== 'polar' ? settings.image.mask : null;
  setBusy(true);
  try {
    const result = await runJob(params, image);
    setProgress(1);
    $('busy-text').textContent = 'Drawing…';
    await new Promise((r) => setTimeout(r, 0));
    const maze = assembleMaze(params, image, result);
    state.maze = maze;
    view.showSolution = false;
    $('solution-btn').setAttribute('aria-pressed', 'false');
    view.setMaze(maze);
    renderStats(maze);
    if (params.outline !== 'image') history.replaceState(null, '', `?${settings.toQuery(params)}`);
    else history.replaceState(null, '', location.pathname);
  } catch (err) {
    if (err.message !== 'cancelled') toast(err.message || String(err), 6000);
  } finally {
    state.job = null;
    setBusy(false);
  }
}

function renderStats(maze) {
  const s = maze.stats;
  const items = [
    ['Cells', s.cells.toLocaleString()],
    ['Solution', `${s.solutionLength.toLocaleString()} cells`],
    ['Covers', `${(s.coverage * 100).toFixed(1)}% of maze`],
    ['Dead ends', s.deadEnds.toLocaleString()],
    ['Algorithm', getAlgorithm(s.algorithm).name.replace(' (tuned by difficulty)', '')],
    ['Seed', maze.params.seed],
    ['Generated in', `${s.ms.toLocaleString()} ms`],
  ];
  const dl = $('stats');
  dl.innerHTML = '';
  for (const [k, v] of items) {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    div.append(dt, dd);
    dl.append(div);
  }
}

// ---------- Play mode ----------
function enterPlay() {
  if (!state.maze || state.playing) return;
  state.playing = true;
  document.body.classList.add('playing');
  $('view-tools').hidden = true;
  $('play-tools').hidden = false;
  $('play-help').hidden = false;
  setTimeout(() => {
    $('play-help').hidden = true;
  }, 7000);
  game.start(state.maze, { fog: $('fog-toggle').checked, fogRadius: Number($('fog-radius').value) });
  $('maze-canvas').focus({ preventScroll: true });
}

function exitPlay() {
  if (!state.playing) return;
  state.playing = false;
  game.exit();
  document.body.classList.remove('playing');
  $('view-tools').hidden = false;
  $('play-tools').hidden = true;
  $('play-help').hidden = true;
  view.showSolution = $('solution-btn').getAttribute('aria-pressed') === 'true';
  view.requestDraw();
}

function bestKey(maze) {
  if (maze.params.outline === 'image') return null;
  return `maze-best:${settings.toQuery(maze.params)}`;
}

function showWin({ time, moves, optimal }) {
  const key = bestKey(state.maze);
  let best = null;
  let newBest = false;
  try {
    if (key) {
      best = Number(localStorage.getItem(key)) || null;
      if (!best || time < best) {
        localStorage.setItem(key, String(Math.round(time)));
        newBest = best !== null;
        best = time;
      }
    }
  } catch {}
  const efficiency = moves ? Math.min(100, (optimal / moves) * 100) : 100;
  const rows = [
    ['Time', formatTime(time)],
    ['Moves', moves.toLocaleString()],
    ['Shortest path', `${optimal.toLocaleString()} moves`],
    ['Efficiency', `${efficiency.toFixed(0)}%`],
  ];
  if (best !== null) rows.push(['Best time', `${formatTime(best)}${newBest ? ' · new best!' : ''}`]);
  const dl = $('win-stats');
  dl.innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    if (k === 'Best time' && newBest) dd.className = 'new-best';
    dl.append(dt, dd);
  }
  $('win-title').textContent = efficiency >= 99.5 ? 'Perfect run!' : 'You solved it!';
  view.requestDraw();
  setTimeout(() => $('win-dialog').showModal(), 250);
}

$('win-dialog').addEventListener('close', () => {
  const v = $('win-dialog').returnValue;
  if (v === 'again') game.restart();
  else if (v === 'new') generate().then(() => state.maze && enterPlay());
});

// ---------- Printing ----------
function defaultPaper() {
  const lang = navigator.language || 'en-US';
  return /^en-(US|CA)|^es-(MX|US)|^fr-CA/.test(lang) ? 'letter' : 'a4';
}

function loadPrintPrefs() {
  try {
    return JSON.parse(localStorage.getItem('maze-print') || '{}');
  } catch {
    return {};
  }
}

function printOpts() {
  return {
    content: document.querySelector('#print-form input[name="content"]:checked').value,
    paper: $('paper').value,
    orientation: $('orientation').value,
    margin: Number($('margin').value),
    title: $('print-title').value.trim(),
    nameLine: $('print-name').checked,
  };
}

function updatePrintPreview() {
  const maze = state.maze;
  if (!maze) return;
  const o = printOpts();
  const L = printLayout(maze, o);
  const k = Math.min(240 / L.pageW, 300 / L.pageH);
  const dpr = window.devicePixelRatio || 1;
  const canvas = $('print-preview-canvas');
  canvas.width = Math.round(L.pageW * k * dpr);
  canvas.height = Math.round(L.pageH * k * dpr);
  canvas.style.width = `${Math.round(L.pageW * k)}px`;
  canvas.style.height = `${Math.round(L.pageH * k)}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, L.pageW, L.pageH);
  const x0 = L.margin;
  let y0 = L.margin;
  if (L.header) {
    ctx.fillStyle = '#c9c9c9';
    if (o.title) ctx.fillRect(x0, y0 + 5, Math.min(60, L.areaW * 0.45), 5);
    if (o.nameLine) ctx.fillRect(x0 + L.areaW - Math.min(80, L.areaW * 0.45), y0 + 9, Math.min(80, L.areaW * 0.45), 0.8);
    y0 += L.header;
  }
  const mx = x0 + (L.areaW - L.w) / 2;
  const my = y0 + (L.areaH - L.h) / 2;
  if (maze.grid.count <= 300_000) {
    const solution = o.content === 'solution';
    const img = renderMazeImage(maze, {
      pxPerUnit: (L.mmPerUnit * k * dpr) * 2,
      maxPx: 2000,
      solution,
      background: false,
      colors: { ...PRINT_COLORS, bg: '#fff' },
    });
    ctx.drawImage(img, mx, my, L.w, L.h);
  } else {
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(mx, my, L.w, L.h);
  }

  const pages = o.content === 'both' ? 2 : 1;
  const cellUnits = maze.grid.kind === 'hex' ? Math.sqrt(3) : 1;
  const cellMm = L.mmPerUnit * cellUnits;
  $('print-info').textContent = `${pages} page${pages > 1 ? 's' : ''} · ${L.landscape ? 'landscape' : 'portrait'} · each cell ≈ ${cellMm < 10 ? cellMm.toFixed(1) : Math.round(cellMm)} mm`;
  const warn = $('print-warning');
  warn.hidden = cellMm >= 1.5;
  warn.textContent = 'Cells will print very small, so the maze will be hard to solve with a pen. Try a larger paper size or a smaller maze.';
}

function openPrint() {
  if (!state.maze) return;
  const prefs = loadPrintPrefs();
  const paper = $('paper');
  if (!paper.options.length) {
    for (const [k, p] of Object.entries(PAPERS)) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = p.label;
      paper.append(opt);
    }
  }
  paper.value = prefs.paper || defaultPaper();
  if (prefs.orientation) $('orientation').value = prefs.orientation;
  if (prefs.margin) $('margin').value = prefs.margin;
  if (prefs.content) document.querySelector(`#print-form input[name="content"][value="${prefs.content}"]`).checked = true;
  if (prefs.nameLine !== undefined) $('print-name').checked = prefs.nameLine;
  $('print-dialog').returnValue = 'cancel';
  $('print-dialog').showModal();
  updatePrintPreview();
}

$('print-form').addEventListener('input', updatePrintPreview);
$('print-dialog').addEventListener('close', () => {
  if ($('print-dialog').returnValue !== 'print' || !state.maze) return;
  const o = printOpts();
  try {
    localStorage.setItem('maze-print', JSON.stringify({ ...o, title: undefined }));
  } catch {}
  if (state.maze.grid.count > 1_000_000) toast('Preparing a very large maze for printing. This can take a moment…', 5000);
  setTimeout(() => printMaze(state.maze, o), 30);
});

// ---------- Downloads ----------
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function doDownload(kind) {
  const maze = state.maze;
  if (!maze) return;
  const solution = kind.endsWith('solution');
  const name = `maze-${maze.params.seed || 'custom'}${solution ? '-solution' : ''}`;
  if (kind.startsWith('svg')) {
    const vb = svgViewBox(maze.grid);
    const px = Math.min(20, 4000 / Math.max(vb.w, vb.h));
    const parts = mazeSVGParts(maze, { solution, background: '#ffffff', width: Math.round(vb.w * px), height: Math.round(vb.h * px) });
    download(new Blob(parts, { type: 'image/svg+xml' }), `${name}.svg`);
  } else {
    const canvas = renderMazeImage(maze, { pxPerUnit: 24, maxPx: 8192, solution, colors: { ...PRINT_COLORS, bg: '#ffffff' } });
    canvas.toBlob((b) => (b ? download(b, `${name}.png`) : toast('That maze is too large to export as PNG. Try SVG instead.')), 'image/png');
  }
}

// ---------- Wiring ----------
$('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  generate();
});
$('seed-random').addEventListener('click', () => {
  settings.setSeed(randomSeed());
  generate({ newSeed: false });
});
$('cancel').addEventListener('click', cancelJob);

$('play-btn').addEventListener('click', enterPlay);
$('exit-play-btn').addEventListener('click', exitPlay);
$('restart-btn').addEventListener('click', () => game.restart());
$('giveup-btn').addEventListener('click', () => game.giveUp());
$('fog-toggle').addEventListener('change', () => {
  $('fog-radius-wrap').hidden = !$('fog-toggle').checked;
  game.setFog($('fog-toggle').checked, Number($('fog-radius').value));
});
$('fog-radius').addEventListener('input', () => game.setFog($('fog-toggle').checked, Number($('fog-radius').value)));

$('solution-btn').addEventListener('click', () => {
  const on = $('solution-btn').getAttribute('aria-pressed') !== 'true';
  $('solution-btn').setAttribute('aria-pressed', String(on));
  view.showSolution = on;
  view.requestDraw();
});
$('print-btn').addEventListener('click', openPrint);
$('share-btn').addEventListener('click', async () => {
  if (!state.maze) return;
  if (state.maze.params.outline === 'image') {
    toast("Mazes made from an uploaded image can't be shared as a link. Download or print them instead.", 5000);
    return;
  }
  const url = `${location.origin}${location.pathname}?${settings.toQuery(state.maze.params)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied. Anyone who opens it gets this exact maze.');
  } catch {
    prompt('Copy this link:', url);
  }
});

const menu = $('download-menu');
$('download-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  $('download-btn').setAttribute('aria-expanded', String(!menu.hidden));
});
menu.addEventListener('click', (e) => {
  const kind = e.target.closest('button')?.dataset.download;
  if (!kind) return;
  menu.hidden = true;
  doDownload(kind);
});
document.addEventListener('click', () => {
  menu.hidden = true;
});

$('zoom-in').addEventListener('click', () => view.zoomAt(1.4));
$('zoom-out').addEventListener('click', () => view.zoomAt(1 / 1.4));
$('zoom-fit').addEventListener('click', () => view.fit());

$('theme-toggle').addEventListener('click', () => {
  const dark = readColors().bg.toLowerCase() !== '#fffdf8';
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('maze-theme', next);
  } catch {}
  view.refreshColors();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => view.refreshColors());

// ---------- Start ----------
const fromUrl = Settings.fromQuery(location.search);
if (fromUrl) {
  settings.write(fromUrl);
  document.getElementById('seed-keep').checked = false;
  generate({ newSeed: false });
} else {
  settings.setSeed(randomSeed());
  generate({ newSeed: false });
}
