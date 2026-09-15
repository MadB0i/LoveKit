import { describe, expect, it } from 'vitest';
import { DISCUSSION_STARTERS } from '../src/lib/ai';
import { CARD_CATEGORIES, TEMPLATES, fillTemplate } from '../src/data/templates';
import { THIS_OR_THAT_PAIRS } from '../src/games/thisOrThat';

/**
 * Content invariants for community-contributed romance copy.
 * Also encodes the store-safe policy: suggestive is fine, explicit is not.
 * (Deliberately short clinical list — anything on it fails the suite.)
 */
const NEVER_WORDS = ['porn', 'xxx', 'nude pic', 'send nudes', 'explicit photo'];

function containsNeverWord(s: string): string | null {
  const low = s.toLowerCase();
  return NEVER_WORDS.find((w) => low.includes(w)) ?? null;
}

describe('message templates', () => {
  it('have unique ids, valid categories, bounded bodies, known placeholders', () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(TEMPLATES.length);
    const cats = new Set(CARD_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) {
      expect(cats.has(t.category)).toBe(true);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(20);
      expect(t.body.length).toBeLessThanOrEqual(600);
      const unknown = t.body.match(/{{[a-z]+}}/g)?.filter((p) => p !== '{{partner}}' && p !== '{{sender}}');
      expect(unknown ?? []).toEqual([]);
      expect(containsNeverWord(t.body)).toBeNull();
    }
  });

  it('date-night category exists with flirty-but-tasteful starters', () => {
    expect(catsHas('date-night')).toBe(true);
    const dates = TEMPLATES.filter((t) => t.category === 'date-night');
    expect(dates.length).toBeGreaterThanOrEqual(5);
    const filled = fillTemplate(dates[0].body, 'Maya', 'Dev');
    expect(filled).toContain('Maya');
    expect(filled).not.toContain('{{');
  });

  it('every occasion (except blank custom) has at least one starter', () => {
    for (const c of CARD_CATEGORIES) {
      if (c.id === 'custom') continue;
      expect(TEMPLATES.some((t) => t.category === c.id)).toBe(true);
    }
  });

  function catsHas(id: string): boolean {
    return CARD_CATEGORIES.some((c) => c.id === id);
  }
});

describe('couple content stays tasteful', () => {
  it('discussion starters and game pairs keep it classy', () => {
    for (const s of DISCUSSION_STARTERS) expect(containsNeverWord(s)).toBeNull();
    const pairIds = new Set(THIS_OR_THAT_PAIRS.map((p) => p.id));
    expect(pairIds.size).toBe(THIS_OR_THAT_PAIRS.length);
    for (const p of THIS_OR_THAT_PAIRS) {
      expect(p.a).toBeTruthy();
      expect(p.b).toBeTruthy();
      expect(p.a).not.toBe(p.b);
      expect(containsNeverWord(`${p.a} ${p.b}`)).toBeNull();
    }
    expect(THIS_OR_THAT_PAIRS.some((p) => p.id === 'datenight')).toBe(true);
  });
});
