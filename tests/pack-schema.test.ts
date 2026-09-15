import { describe, expect, it } from 'vitest';
import type { StickerPack } from '../src/lib/types';
import { packManifest, validatePackManifest } from '../src/lib/whatsapp';

const PACK: StickerPack = {
  id: 'pack_1',
  name: 'Us ❤️',
  author: 'Dev',
  description: 'For Maya',
  stickerIds: ['a', 'b', 'c'],
  createdAt: 0,
};

function names(n: number): { id: string; name: string }[] {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Sticker ${i + 1}` }));
}

describe('frozen pack schema (bridge contract)', () => {
  it('our own exporter output validates', () => {
    const json = packManifest(PACK, names(3));
    const check = validatePackManifest(JSON.parse(json));
    expect(check).toEqual({ ok: true, errors: [] });
  });

  it('rejects wrong format, version, names and counts', () => {
    const good = JSON.parse(packManifest(PACK, names(3))) as Record<string, unknown>;
    expect(validatePackManifest({ ...good, format: 'other-pack' }).ok).toBe(false);
    expect(validatePackManifest({ ...good, version: 999 }).ok).toBe(false);
    expect(validatePackManifest({ ...good, name: '  ' }).errors).toContain('Pack needs a name.');
    expect(validatePackManifest({ ...good, author: '' }).errors).toContain('Pack needs an author.');
    expect(validatePackManifest({ ...good, stickers: [] }).ok).toBe(false);
    expect(validatePackManifest({ ...good, stickers: names(31).map((s, i) => ({ file: `sticker_${i}.png`, emoji: ['❤️'], name: s.name })) }).ok).toBe(false);
    expect(validatePackManifest('just a string').ok).toBe(false);
    expect(validatePackManifest(null).ok).toBe(false);
  });

  it('rejects bad sticker entries with pinpointed errors', () => {
    const good = JSON.parse(packManifest(PACK, names(3))) as Record<string, unknown>;
    const bad = {
      ...good,
      stickers: [
        { file: '../../evil.png', emoji: ['❤️'], name: 'x' },
        { file: 'sticker_02.png', emoji: [], name: 'y' },
        { file: 'sticker_03.png', emoji: ['❤️'], name: 'z' },
      ],
    };
    const check = validatePackManifest(bad);
    expect(check.ok).toBe(false);
    expect(check.errors.some((e) => e.includes('#1') && e.includes('file name'))).toBe(true);
    expect(check.errors.some((e) => e.includes('#2') && e.includes('emoji'))).toBe(true);
  });
});
