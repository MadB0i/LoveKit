/**
 * stickerRender.ts — one painter for the sticker editor preview AND exports,
 * so what you see is exactly what WhatsApp gets (512×512, transparent).
 */
import type { Sticker, StickerElement } from './types';

export const STICKER_PX = 512;

const imgCache = new Map<string, HTMLImageElement>();
/** Bound the decode cache: 100-sticker packs on a phone must not OOM it. */
const IMG_CACHE_MAX = 40;

function cacheImage(src: string, img: HTMLImageElement): void {
  imgCache.set(src, img);
  if (imgCache.size > IMG_CACHE_MAX) {
    const oldest = imgCache.keys().next();
    if (!oldest.done) imgCache.delete(oldest.value);
  }
}

export function loadStickerImage(src: string): Promise<HTMLImageElement> {
  const hit = imgCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cacheImage(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawElement(ctx: CanvasRenderingContext2D, el: StickerElement): Promise<void> {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.scale((el.flipX ? -1 : 1) * el.scale, el.scale);

  if (el.kind === 'text') {
    const size = el.fontSize ?? 64;
    const weight = el.fontWeight ?? 800;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = el.align ?? 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const lines = (el.text ?? '').split('\n').slice(0, 4);
    const lh = size * 1.15;
    const y0 = -((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      const y = y0 + i * lh;
      if (el.outline) {
        ctx.lineWidth = Math.max(2, size / 10);
        ctx.strokeStyle = el.outline;
        ctx.strokeText(line, 0, y);
      }
      ctx.fillStyle = el.color ?? '#ffffff';
      ctx.fillText(line, 0, y);
    });
  } else if (el.kind === 'image' && el.image) {
    const img = await loadStickerImage(el.image);
    const box = el.size ?? 300;
    const fit = Math.min(box / img.naturalWidth, box / img.naturalHeight) || 1;
    const w = img.naturalWidth * fit;
    const h = img.naturalHeight * fit;
    // White "die-cut" halo behind the photo.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 26);
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 26);
    ctx.clip();
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else if (el.kind === 'emoji' || el.kind === 'heart') {
    const size = el.size ?? 120;
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.kind === 'heart' ? '❤️' : (el.text ?? '😍'), 0, 0);
  }
  ctx.restore();
}

/** Paint a sticker. `halo` draws the white outline betweeen subject & transparency. */
export async function renderSticker(
  ctx: CanvasRenderingContext2D,
  sticker: Sticker,
  opts: { halo?: boolean } = {},
): Promise<void> {
  ctx.save();
  ctx.clearRect(0, 0, STICKER_PX, STICKER_PX);
  if (!sticker.backgroundTransparent) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, STICKER_PX, STICKER_PX);
  }
  for (const el of sticker.elements ?? []) {
    try {
      await drawElement(ctx, el);
    } catch {
      /* a broken image must not kill the whole sticker */
    }
  }
  if (opts.halo && sticker.borderWidth > 0) {
    ctx.strokeStyle = sticker.borderColor || '#ffffff';
    ctx.lineWidth = sticker.borderWidth;
    roundRectPath(ctx, 8, 8, STICKER_PX - 16, STICKER_PX - 16, 40);
    ctx.stroke();
  }
  ctx.restore();
}

export async function stickerToDataUrl(sticker: Sticker, mime: 'image/png' | 'image/webp' = 'image/png'): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = STICKER_PX;
  canvas.height = STICKER_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  await renderSticker(ctx, sticker, { halo: true });
  return canvas.toDataURL(mime);
}

/** Tray icon: 96×96 version of a sticker (WhatsApp spec). */
export async function stickerToTrayUrl(sticker: Sticker): Promise<string> {
  const big = document.createElement('canvas');
  big.width = STICKER_PX;
  big.height = STICKER_PX;
  const bctx = big.getContext('2d');
  if (!bctx) throw new Error('Canvas unavailable');
  await renderSticker(bctx, sticker, { halo: true });
  const small = document.createElement('canvas');
  small.width = 96;
  small.height = 96;
  const sctx = small.getContext('2d');
  if (!sctx) throw new Error('Canvas unavailable');
  sctx.drawImage(big, 0, 0, 96, 96);
  return small.toDataURL('image/png');
}
