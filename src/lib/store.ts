/**
 * store.ts — tiny versioned localStorage layer.
 *
 * LoveKit is local-first: cards, memories, coupons, capsules, stickers and
 * game sessions live in the browser. Nothing is sent to a server (there is
 * no server). All helpers fail soft — private-mode / quota errors surface
 * as `{ ok: false }` instead of throwing into the UI.
 */

import type { Coupon, LoveCard, Memory, Sticker, StickerPack, TimeCapsule } from './types';

export const KEYS = {
  cards: 'lovekit.cards.v1',
  packs: 'lovekit.sticker-packs.v1',
  memories: 'lovekit.memories.v1',
  coupons: 'lovekit.coupons.v1',
  capsules: 'lovekit.capsules.v1',
  games: 'lovekit.games.v1',
  settings: 'lovekit.settings.v1',
} as const;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Corrupt-shape recovery: localStorage can hold anything (old versions,
 * manual tampering, other-site collisions on file://). A stored string where
 * we expect an array must NEVER crash a page — validate and recover to [].
 */
export function loadArray<T>(key: string, isItem: (x: unknown) => x is T): T[] {
  const raw = load<unknown>(key, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isItem);
}

function hasId(x: unknown): x is { id: string } {
  return typeof x === 'object' && x !== null && typeof (x as { id: unknown }).id === 'string';
}

export function isCard(x: unknown): x is LoveCard {
  return hasId(x);
}

export function isSticker(x: unknown): x is Sticker {
  return hasId(x) && Array.isArray((x as Sticker).elements);
}

export function isPack(x: unknown): x is StickerPack {
  return hasId(x) && Array.isArray((x as StickerPack).stickerIds);
}

export function isMemory(x: unknown): x is Memory {
  return hasId(x);
}

export function isCoupon(x: unknown): x is Coupon {
  return hasId(x);
}

export function isCapsule(x: unknown): x is TimeCapsule {
  const c = x as TimeCapsule;
  return hasId(x) && typeof c.sealed === 'string' && typeof c.unlockAt === 'number';
}

/** Validated settings load — a corrupt record falls back to safe defaults. */
export function loadSettings(): AppSettings {
  const raw = load<unknown>(KEYS.settings, DEFAULT_SETTINGS);
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const theme = r.theme === 'dark' || r.theme === 'light' || r.theme === 'system' ? r.theme : 'system';
  return { theme, reduceMotion: r.reduceMotion === true };
}

export function save(key: string, value: unknown): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage unavailable';
    return { ok: false, error: message };
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode — nothing to do */
  }
}

/** Collision-resistant id without any dependency. */
export function uid(prefix = 'id'): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
    }
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = { theme: 'system', reduceMotion: false };
