// Turns an uploaded image into a binary shape mask with a live preview.
const MAX_DIM = 512;

export class ImageMask {
  constructor({ file, label, threshold, thresholdOut, invert, preview, onChange }) {
    Object.assign(this, { fileInput: file, label, threshold, thresholdOut, invert, preview, onChange });
    this.data = null;
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f) this.load(f).catch(() => this._error('Could not read that image. Try a PNG or JPEG.'));
    });
    threshold.addEventListener('input', () => this.update());
    invert.addEventListener('change', () => this.update());
  }

  get mask() {
    return this.data ? { data: this.data, w: this.w, h: this.h } : null;
  }

  get aspect() {
    return this.data ? this.w / this.h : 1;
  }

  async load(f) {
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      this.lum = new Uint8Array(w * h);
      this.alpha = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        this.lum[i] = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]);
        this.alpha[i] = px[i * 4 + 3];
      }
      this.w = w;
      this.h = h;
      this.label.innerHTML = '';
      this.label.append(f.name);
      const small = document.createElement('small');
      small.textContent = 'Click to choose a different image';
      this.label.append(small);
      this.update(true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  update(fresh = false) {
    this.thresholdOut.textContent = `${this.threshold.value}%`;
    if (!this.lum) return;
    const t = (Number(this.threshold.value) / 100) * 255;
    const inv = this.invert.checked;
    const { w, h } = this;
    const data = new Uint8Array(w * h);
    let inside = 0;
    for (let i = 0; i < w * h; i++) {
      const on = this.alpha[i] >= 128 && (this.lum[i] < t) !== inv;
      data[i] = on ? 1 : 0;
      inside += data[i];
    }
    this.data = data;
    this._drawPreview();
    this.onChange?.({ fresh, empty: inside === 0 });
  }

  _drawPreview() {
    const { w, h, data, preview } = this;
    const k = Math.min(160 / w, 120 / h);
    preview.width = Math.max(1, Math.round(w * k));
    preview.height = Math.max(1, Math.round(h * k));
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const sctx = src.getContext('2d');
    const img = sctx.createImageData(w, h);
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1d2433';
    const n = parseInt(ink.slice(1), 16) || 0;
    for (let i = 0; i < w * h; i++) {
      if (!data[i]) continue;
      img.data[i * 4] = n >> 16;
      img.data[i * 4 + 1] = (n >> 8) & 255;
      img.data[i * 4 + 2] = n & 255;
      img.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, preview.width, preview.height);
  }

  _error(msg) {
    this.onChange?.({ error: msg });
  }
}
