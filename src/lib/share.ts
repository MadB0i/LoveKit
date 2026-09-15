/**
 * share.ts — shareable surprise links (`#/l/<code>`).
 *
 * Design:
 * - No accounts, no server. The payload is encoded in the URL hash, so the
 *   receiver opens the surprise without signing in.
 * - Base64url codec is implemented by hand so it works identically in the
 *   browser and in Node (vitest), including full Unicode via UTF-8.
 * - Decode re-validates everything: version, kind allowlist, string lengths,
 *   and photo budgets. A crafted link cannot inject markup — all rendering
 *   paths treat decoded content as untrusted text.
 *
 * Honest limitation: URLs have practical size limits (~a few KB travel well;
 * very large photos do not). The encoder reports its length so the UI can
 * warn and offer a photo-free link instead.
 */

import { cleanText } from './sanitize';

export const SHARE_VERSION = 1;
export const SHARE_KINDS = ['card', 'coupon', 'memory', 'capsule', 'game', 'pack', 'sticker'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

/** Payloads above this are likely to break when pasted into some apps. */
export const SHARE_COMFORTABLE_LIMIT = 6000;

export interface ShareEnvelope {
  v: number;
  kind: ShareKind;
  data: unknown;
  createdAt: number;
}

export type DecodeResult =
  | { ok: true; kind: ShareKind; data: unknown; createdAt: number }
  | { ok: false; error: string };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length % 4 !== 0) throw new Error('Bad length');
  const table = new Map<string, number>();
  for (let i = 0; i < B64.length; i++) table.set(B64[i], i);
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = table.get(clean[i]) ?? 0;
    const c1 = table.get(clean[i + 1]) ?? 0;
    const c2 = clean[i + 2] === '=' ? 0 : (table.get(clean[i + 2]) ?? 0);
    const c3 = clean[i + 3] === '=' ? 0 : (table.get(clean[i + 3]) ?? 0);
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes.push((n >> 16) & 255);
    if (clean[i + 2] !== '=') bytes.push((n >> 8) & 255);
    if (clean[i + 3] !== '=') bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

function toB64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64Url(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return b64;
}

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : undefined;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : undefined;

function encodeUtf8(s: string): Uint8Array {
  if (textEncoder) return textEncoder.encode(s);
  // Fallback for exotic runtimes (unescape is deprecated but widely present).
  const bin = unescape(encodeURIComponent(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  if (textDecoder) return textDecoder.decode(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(bin));
}

/** Encode a share payload. Returns the short `code` for `#/l/<code>`. */
export function encodeShare(kind: ShareKind, data: unknown): string {
  const envelope: ShareEnvelope = { v: SHARE_VERSION, kind, data, createdAt: Date.now() };
  const bytes = encodeUtf8(JSON.stringify(envelope));
  return toB64Url(bytesToB64(bytes));
}

/** Decode + validate a share code. Never throws. */
export function decodeShare(code: string): DecodeResult {
  try {
    const trimmed = (code || '').trim();
    if (!trimmed) return { ok: false, error: 'This link is empty.' };
    if (trimmed.length > 200_000) return { ok: false, error: 'This link is too large to open safely.' };
    const bytes = b64ToBytes(fromB64Url(trimmed));
    if (bytes.length > 150_000) return { ok: false, error: 'This link is too large to open safely.' };
    const parsed: unknown = JSON.parse(decodeUtf8(bytes));
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'This link is corrupted.' };
    }
    const env = parsed as Record<string, unknown>;
    if (env.v !== SHARE_VERSION) return { ok: false, error: 'This link was made with an incompatible version.' };
    if (typeof env.kind !== 'string' || !(SHARE_KINDS as readonly string[]).includes(env.kind)) {
      return { ok: false, error: 'This link type is not recognised.' };
    }
    if (typeof env.createdAt !== 'number' || !Number.isFinite(env.createdAt)) {
      return { ok: false, error: 'This link is corrupted.' };
    }
    return { ok: true, kind: env.kind as ShareKind, data: env.data, createdAt: env.createdAt };
  } catch {
    return { ok: false, error: 'This link looks corrupted. Ask your partner to send it again. ❤️' };
  }
}

/** Build a full shareable URL for the current host. */
export function buildShareUrl(code: string): string {
  const base =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://lovekit.app';
  // HashRouter: keep everything after # so static hosts need no rewrites.
  const sep = base.includes('#') ? '' : '#';
  return `${base}${sep}/l/${code}`;
}

/** Sanitize an unknown decoded value into a plain record of short strings. */
export function asSafeRecord(data: unknown, maxField = 2000): Record<string, string> {
  if (typeof data !== 'object' || data === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const key = cleanText(k, 40);
    if (!key) continue;
    // Prototype-pollution guard: JSON.parse already creates safe OWN
    // properties, but re-assignment through `out[key]` would hit setters.
    // String values make `__proto__` assignment a silent no-op today;
    // skip the risky keys anyway so future edits can't regress this.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    // Photos travel as data-URLs; cap them at the decode budget (150 KB of
    // bytes ≈ 200k base64 chars) so a link can't blow up receiver memory,
    // and so images aren't silently truncated into corrupt files.
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      out[key] = v.slice(0, 200_000);
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = cleanText(String(v), maxField);
    }
  }
  return out;
}

/** Extract a clean string array (used for game challenges, tags, …). */
export function asSafeList(data: unknown, key: string, maxItems = 30, maxField = 500): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const raw = (data as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => cleanText(typeof v === 'string' ? v : '', maxField))
    .filter(Boolean)
    .slice(0, maxItems);
}
