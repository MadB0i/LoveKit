/**
 * store.ts — tiny versioned localStorage layer.
 *
 * LoveKit is local-first: cards, memories, coupons, capsules, stickers and
 * game sessions live in the browser. Nothing is sent to a server (there is
 * no server). All helpers fail soft — private-mode / quota errors surface
 * as `{ ok: false }` instead of throwing into the UI.
 */

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
