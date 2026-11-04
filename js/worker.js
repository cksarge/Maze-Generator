import { runGeneration } from './generate.js';

self.onmessage = (e) => {
  const { id, params, image } = e.data;
  try {
    let last = 0;
    const res = runGeneration(params, image, (p) => {
      const now = Date.now();
      if (now - last > 100) {
        last = now;
        self.postMessage({ id, type: 'progress', p });
      }
    });
    self.postMessage({ id, type: 'done', result: res }, [res.links.buffer, res.solution.buffer]);
  } catch (err) {
    const oom = err instanceof RangeError;
    self.postMessage({
      id,
      type: 'error',
      message: oom ? 'Your device ran out of memory for a maze this large. Try a smaller size.' : err.message || String(err),
    });
  }
};
