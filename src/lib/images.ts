/**
 * images.ts — browser image pipeline. Uploads are downscaled on-device so
 * originals never need to leave the phone, and share-links stay small.
 */

export interface DownscaleOptions {
  maxDim?: number;
  quality?: number;
  mime?: 'image/jpeg' | 'image/webp' | 'image/png';
}

/** Refuse absurd uploads BEFORE decoding (a 50 MP photo can OOM a cheap phone). */
export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** Returns a friendly reason, or null when the file is worth decoding. */
export function checkImageFile(file: Blob): string | null {
  if (!file.type.startsWith('image/')) return 'That file is not an image. Try a JPG, PNG or WebP.';
  if (file.size === 0) return 'That file looks empty or corrupt. Try another one.';
  if (file.size > IMAGE_MAX_BYTES) {
    return `That photo is huge (${(file.size / 1048576).toFixed(0)} MB). Please pick one under 25 MB.`;
  }
  return null;
}

/** Load a File/Blob into an <img> via object URL. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/**
 * Convert an uploaded file to a compact data-URL (downscaled, recompressed).
 * Default 1200px is plenty for cards/memories; stickers use 512.
 */
export async function fileToDataUrl(file: Blob, opts: DownscaleOptions = {}): Promise<string> {
  const { maxDim = 1200, quality = 0.82, mime = 'image/jpeg' } = opts;
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objUrl);
    return drawDownscaled(img, maxDim, quality, mime);
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/** Downscale an existing data-URL (used before stuffing photos into links). */
export async function downscaleDataUrl(
  dataUrl: string,
  opts: DownscaleOptions = {},
): Promise<string> {
  const { maxDim = 480, quality = 0.7, mime = 'image/jpeg' } = opts;
  const img = await loadImage(dataUrl);
  return drawDownscaled(img, maxDim, quality, mime);
}

function drawDownscaled(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
  mime: string,
): Promise<string> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  // JPEG has no alpha — paint a warm paper base instead of black.
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#f7f1e8';
    ctx.fillRect(0, 0, dw, dh);
  }
  ctx.drawImage(img, 0, 0, dw, dh);
  return Promise.resolve(canvas.toDataURL(mime, quality));
}

/** Rough byte size of a data-URL (base64 ≈ 4/3 overhead). */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor(b64.length * 0.75);
}
