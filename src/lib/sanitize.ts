/**
 * sanitize.ts — input validation & XSS-safe text helpers.
 *
 * Privacy-first rules:
 * - All user content is rendered as text (React escapes by default).
 * - Anything injected into SVG / canvas / URLs goes through these helpers.
 * - Shared-link payloads are re-validated on decode (see share.ts).
 */

// Stripping ASCII control characters is the entire point of the regex below.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip control characters and trim. Never throws. */
export function cleanText(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

/** Escape a string for safe embedding inside HTML/SVG markup. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** True for http(s) URLs only — blocks javascript:, data:, etc. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** True for image data-URLs we generate ourselves (upload/compress pipeline). */
export function isImageDataUrl(url: string): boolean {
  return /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url);
}

/** Names: short, single-line, no markup. */
export function cleanName(input: unknown): string {
  return cleanText(input, 60).replace(/\s+/g, ' ');
}

/** Clamp an integer into a range (for counts, sizes, indexes). */
export function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.min(max, Math.max(min, v));
}
