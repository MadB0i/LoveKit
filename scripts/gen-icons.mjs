/**
 * gen-icons.mjs — dependency-free PWA icon generator.
 * Draws LoveKit's heart mark (plum → terracotta gradient + cream heart)
 * pixel-by-pixel and writes real PNGs (manual chunks + CRC32, zlib builtin).
 * Run: `node scripts/gen-icons.mjs` → writes public/*.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(root, { recursive: true });

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function toPng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolor + alpha
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const PLUM = [43, 26, 34];
const ROSE = [110, 53, 66];
const EMBER = [179, 84, 63];
const CREAM = [250, 240, 228];
const GOLD = [232, 176, 75];
const BLUSH = [240, 166, 160];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Heart implicit function: <= 0 means inside. */
function heart(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
}

/**
 * Render an icon: deep plum → rose → ember gradient, candlelight glow,
 * vignette, and TWO overlapping hearts — one cream, one gold —
 * because LoveKit is for two real people, not one.
 * @param {number} size canvas px
 * @param {boolean} maskable full-bleed + artwork inside the 80% safe zone
 */
function render(size, maskable) {
  const px = new Uint8ClampedArray(size * size * 4);
  const r = size / 2;
  const corner = maskable ? 0 : size * 0.225; // iOS-style squircle-ish radius
  const s = maskable ? size * 0.72 : size; // artwork scale (safe zone)
  const cx = r;
  const cy = r * 1.02;
  // Big cream heart (slightly left-low) + small gold heart (right-high).
  const big = { x: cx - s * 0.055, y: cy + s * 0.03, k: s * 0.30 };
  const small = { x: cx + s * 0.20, y: cy - s * 0.20, k: s * 0.155 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Rounded-rect mask (skipped for maskable full-bleed).
      let alpha = 1;
      if (!maskable) {
        const dx = Math.min(x, size - 1 - x);
        const dy = Math.min(y, size - 1 - y);
        if (dx < 0 || dy < 0) alpha = 0;
        else if (dx < corner && dy < corner) {
          const d = Math.hypot(corner - dx, corner - dy);
          alpha = d <= corner ? 1 : 0;
        }
      }
      // Three-stop vertical gradient: plum → rose → ember.
      const t = y / (size - 1);
      const mid = t < 0.55 ? t / 0.55 : 1;
      const top = t < 0.55 ? PLUM : ROSE;
      const bot = t < 0.55 ? ROSE : EMBER;
      const tt = t < 0.55 ? mid : (t - 0.55) / 0.45;
      let R = lerp(top[0], bot[0], tt);
      let G = lerp(top[1], bot[1], tt);
      let B = lerp(top[2], bot[2], tt);
      // Candlelight glow, upper-left.
      const gd = Math.hypot(x - size * 0.3, y - size * 0.26) / size;
      const glow = Math.max(0, 1 - gd * 2.1) * 0.28;
      R = lerp(R, GOLD[0], glow);
      G = lerp(G, GOLD[1], glow);
      B = lerp(B, GOLD[2], glow);
      // Gentle vignette for depth.
      const vd = Math.hypot(x - r, y - r) / r;
      const vig = 1 - Math.max(0, vd - 0.72) * 0.35;
      R *= vig;
      G *= vig;
      B *= vig;
      // Hearts, y-flipped, softly anti-aliased. Small one first (behind).
      const paint = (h, col) => {
        const hx = (x - h.x) / h.k;
        const hy = -(y - h.y) / h.k;
        const inside = clamp01(0.5 - heart(hx, hy) * 7);
        R = lerp(R, col[0], inside);
        G = lerp(G, col[1], inside);
        B = lerp(B, col[2], inside);
        return inside;
      };
      paint(small, BLUSH);
      const bigIn = paint(big, CREAM);
      // Gold rim light on the big heart's upper-left edge.
      if (bigIn > 0.02 && bigIn < 0.98) {
        const hx = (x - big.x) / big.k;
        const hy = -(y - big.y) / big.k;
        if (hx < 0 && hy > 0) {
          const rim = (1 - bigIn) * 0.7;
          R = lerp(R, GOLD[0], rim);
          G = lerp(G, GOLD[1], rim);
          B = lerp(B, GOLD[2], rim);
        }
      }
      px[i] = R;
      px[i + 1] = G;
      px[i + 2] = B;
      px[i + 3] = alpha * 255;
    }
  }
  return toPng(size, size, px);
}

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon-180.png', 180, true], // Apple masks it; full-bleed is correct
];
for (const [name, size, maskable] of jobs) {
  const t0 = Date.now();
  writeFileSync(join(root, name), render(size, maskable));
  console.log(`${name} (${size}px${maskable ? ', maskable' : ''}) in ${Date.now() - t0}ms`);
}
