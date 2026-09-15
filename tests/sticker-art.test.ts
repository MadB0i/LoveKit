import { describe, expect, it } from 'vitest';
import { STICKER_ART } from '../src/data/stickerArt';

/**
 * Sweethearts pack invariants: original art only, valid SVG, and provably
 * no active content (stickers get rasterized + shared — a script smuggled
 * into art would be a supply-chain incident).
 */
describe('sweethearts art pack', () => {
  it('has 12 uniquely-identified entries with names and urls', () => {
    expect(STICKER_ART).toHaveLength(12);
    const ids = new Set(STICKER_ART.map((a) => a.id));
    expect(ids.size).toBe(12);
    for (const a of STICKER_ART) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(typeof a.url).toBe('string');
      expect(a.url.length).toBeGreaterThan(0);
    }
  });

  it('is valid, sized, inert SVG', () => {
    for (const a of STICKER_ART) {
      const src = a.source;
      expect(src.trimStart().startsWith('<svg'), `${a.id}: must start with <svg`).toBe(true);
      expect(src, `${a.id}: needs explicit 512 size`).toContain('width="512"');
      expect(src, `${a.id}: needs explicit 512 size`).toContain('height="512"');
      expect(src, `${a.id}: needs viewBox`).toContain('viewBox');
      expect(src.length, `${a.id}: suspiciously large`).toBeLessThan(20_000);
      const low = src.toLowerCase();
      for (const evil of ['<script', 'javascript:', 'foreignobject', 'onload=', 'onerror=', 'onclick=', 'onmouseover=', 'data:text/html']) {
        expect(low.includes(evil), `${a.id}: forbidden ${evil}`).toBe(false);
      }
    }
  });
});
