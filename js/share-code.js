import { Rng, hashSeed } from './rng.js';

// Scrambles a link's query string into one opaque URL-safe code (?c=...) so the maze
// settings can't be read or edited from the address bar. There is no server, so this is
// obfuscation rather than real encryption: it keeps casual eyes out, not a determined
// person reading this file. A checksum makes edited or truncated codes fail to decode.

const KEY = hashSeed('maze-generator-share');

function keystream(salt, n) {
  const rng = new Rng((KEY ^ salt) >>> 0);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.int(256);
  return out;
}

function toBase64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function encodeShare(query, salt = Math.floor(Math.random() * 65536)) {
  const body = new TextEncoder().encode(query);
  const check = hashSeed(query);
  const plain = new Uint8Array(body.length + 2);
  plain.set(body);
  plain[body.length] = check & 255;
  plain[body.length + 1] = (check >>> 8) & 255;
  const ks = keystream(salt, plain.length);
  const out = new Uint8Array(plain.length + 2);
  out[0] = salt & 255;
  out[1] = (salt >>> 8) & 255;
  for (let i = 0; i < plain.length; i++) out[i + 2] = plain[i] ^ ks[i];
  return toBase64Url(out);
}

// Returns the original query string, or null if the code is invalid.
export function decodeShare(code) {
  try {
    const data = fromBase64Url(code);
    if (data.length < 5) return null;
    const salt = data[0] | (data[1] << 8);
    const ks = keystream(salt, data.length - 2);
    const plain = new Uint8Array(data.length - 2);
    for (let i = 0; i < plain.length; i++) plain[i] = data[i + 2] ^ ks[i];
    const body = plain.subarray(0, plain.length - 2);
    const query = new TextDecoder('utf-8', { fatal: true }).decode(body);
    const check = hashSeed(query);
    if (plain[plain.length - 2] !== (check & 255) || plain[plain.length - 1] !== ((check >>> 8) & 255)) return null;
    return query;
  } catch {
    return null;
  }
}

// share=1 or share=true: play only. share=2: challenge (play only, no giving up).
export function shareModeOf(params) {
  const v = params.get('share');
  if (v === '2') return 'challenge';
  if (v === '1' || v === 'true') return 'play';
  return null;
}
