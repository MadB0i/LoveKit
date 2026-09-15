/**
 * gen-test-pack.mjs — builds a web-shaped sticker export for on-device testing.
 * (Test tooling only, not shipped.) Writes pack.json (exact web schema) +
 * tray_icon.png (96) + 3× 512px PNGs + index.json (bridge internal layout).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';

const out = join(tmpdir(), 'lovekit-seed-pack');
mkdirSync(out, { recursive: true });

// --- minimal PNG writer (copied pattern from gen-icons.mjs) ---
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const toPng = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const heart = (x, y) => {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
};
const render = (size, bg, heartScale, cy) => {
  const px = new Uint8ClampedArray(size * size * 4);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / (size - 1);
      let R = bg[0] + (179 - bg[0]) * t * 0.35;
      let G = bg[1] + (84 - bg[1]) * t * 0.35;
      let B = bg[2] + (63 - bg[2]) * t * 0.35;
      const hx = (x - r) / heartScale;
      const hy = -(y - r * cy) / heartScale;
      const inside = Math.min(1, Math.max(0, 0.5 - heart(hx, hy) * 6));
      R = R + (248 - R) * inside;
      G = G + (236 - G) * inside;
      B = B + (221 - B) * inside;
      px[i] = R;
      px[i + 1] = G;
      px[i + 2] = B;
      px[i + 3] = 255;
    }
  }
  return toPng(size, size, px);
};

const names = ['Miss You', 'Good Morning', 'Muah'];
const bgs = [[74, 36, 54], [20, 51, 58], [36, 31, 61]];
const files = ['sticker_01.png', 'sticker_02.png', 'sticker_03.png'];
files.forEach((f, i) => writeFileSync(join(out, f), render(512, bgs[i], 150, 1.06)));
writeFileSync(join(out, 'tray_icon.png'), render(96, [74, 36, 54], 28, 1.06));

const packJson = {
  format: 'lovekit-sticker-pack',
  version: 1,
  android: { identifier: 'lovekitseedtest', publisher: 'Seed', trayImageFile: 'tray_icon.png' },
  name: 'Seed Pack',
  author: 'Seed',
  description: 'On-device UI smoke test.',
  stickers: files.map((f, i) => ({ file: f, emoji: ['❤️'], name: names[i] })),
  whatsappSpecs: { stickerPx: 512, stickerMaxKb: 100, trayPx: 96, trayMaxKb: 50 },
};
writeFileSync(join(out, 'pack.json'), JSON.stringify(packJson, null, 2));

// Bridge-internal index (what PackStore.save would have written post-conversion;
// here PNGs stay PNG — the detail screen re-probes and shows honest results).
const index = {
  identifier: 'lovekitseedtest',
  name: 'Seed Pack',
  author: 'Seed',
  description: 'On-device UI smoke test.',
  trayFile: 'tray_icon.png',
  dataVersion: Math.floor(Date.now() / 1000),
  stickers: files.map((f, i) => ({ file: f, emoji: ['❤️'], name: names[i] })),
};
writeFileSync(join(out, 'index.json'), JSON.stringify(index));
console.log('seed pack written to', out);
