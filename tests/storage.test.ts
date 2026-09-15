import { afterEach, describe, expect, it } from 'vitest';
import { KEYS, isCapsule, isCard, loadArray, loadSettings, save } from '../src/lib/store';

/** In-memory localStorage stand-in (Node has none). */
function stubStorage(): { mem: Map<string, string>; failWrites: { on: boolean } } {
  const mem = new Map<string, string>();
  const failWrites = { on: false };
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites.on) throw new Error('QuotaExceededError');
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };
  return { mem, failWrites };
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).localStorage;
});

describe('storage recovery', () => {
  it('recovers to [] when stored state has the wrong shape', () => {
    const { mem } = stubStorage();
    mem.set(KEYS.cards, '"just a string"');
    expect(loadArray(KEYS.cards, isCard)).toEqual([]);
    mem.set(KEYS.cards, '{"id": 1}');
    expect(loadArray(KEYS.cards, isCard)).toEqual([]);
    mem.set(KEYS.cards, 'not json {{{');
    expect(loadArray(KEYS.cards, isCard)).toEqual([]);
  });

  it('keeps valid items and drops malformed ones', () => {
    const { mem } = stubStorage();
    mem.set(
      KEYS.cards,
      JSON.stringify([{ id: 'a', message: 'hi' }, { nope: true }, null, 42, { id: 'b' }]),
    );
    const list = loadArray(KEYS.cards, isCard);
    expect(list.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('validates capsule and settings shapes strictly', () => {
    const { mem } = stubStorage();
    mem.set(KEYS.capsules, JSON.stringify([{ id: 'x' }, { id: 'y', sealed: 's', unlockAt: 1 }]));
    expect(loadArray(KEYS.capsules, isCapsule).map((c) => c.id)).toEqual(['y']);
    mem.set(KEYS.settings, JSON.stringify({ theme: 'neon', reduceMotion: 'yes' }));
    expect(loadSettings()).toEqual({ theme: 'system', reduceMotion: false });
    mem.set(KEYS.settings, '"dark"');
    expect(loadSettings()).toEqual({ theme: 'system', reduceMotion: false });
  });

  it('surfaces quota failures instead of throwing', () => {
    const { failWrites } = stubStorage();
    expect(save(KEYS.cards, []).ok).toBe(true);
    failWrites.on = true;
    const res = save(KEYS.cards, [{ id: 'a' }]);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Quota/i);
  });
});
