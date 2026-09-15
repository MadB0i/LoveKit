import { describe, expect, it } from 'vitest';
import { LocalWritingProvider, buildApology, pickStarters } from '../src/lib/ai';
import { packManifest, slug, validatePack } from '../src/lib/whatsapp';

describe('writing helper (local provider)', () => {
  it('shortens, warms and never invents partner roleplay', async () => {
    const ai = new LocalWritingProvider();
    const long =
      'So I was thinking that yesterday when you made tea for me even though you were tired, it really meant a lot to me. Anyway I love you.';
    const short = await ai.transform({ text: long, tone: 'shorter' });
    expect(short.length).toBeLessThan(long.length);
    const warm = await ai.transform({ text: 'Thank you for today', tone: 'warmer' });
    expect(warm).toContain('Thank you for today');
    for (const out of [short, warm]) {
      expect(out.toLowerCase()).not.toContain('as your girlfriend');
      expect(out.toLowerCase()).not.toContain('as your boyfriend');
    }
    await expect(ai.transform({ text: '   ', tone: 'shorter' })).rejects.toThrow();
  });

  it('builds apologies from the user’s own answers', () => {
    const msg = buildApology('Maya', 'Dev', {
      what: 'I forgot our call',
      impact: 'felt unimportant to me',
      own: 'I didn’t set a reminder',
      change: 'I’ll set an alarm labelled “Maya ♥”',
    });
    expect(msg).toContain('Maya');
    expect(msg).toContain('I forgot our call');
    expect(msg).toContain('alarm');
  });

  it('deals deterministic discussion starters', () => {
    expect(pickStarters(3, 42)).toEqual(pickStarters(3, 42));
    expect(pickStarters(4)).toHaveLength(4);
  });
});

describe('sticker packs', () => {
  it('validates WhatsApp pack rules honestly', () => {
    expect(validatePack({ name: '', author: '' }, 0).ok).toBe(false);
    expect(validatePack({ name: 'Us', author: 'Dev' }, 2).ok).toBe(false);
    expect(validatePack({ name: 'Us', author: 'Dev' }, 5).ok).toBe(true);
    expect(validatePack({ name: 'Us', author: 'Dev' }, 31).ok).toBe(false);
  });

  it('emits a portable manifest + safe slugs', () => {
    const json = packManifest(
      { id: 'pack_1', name: 'Us ❤️', author: 'Dev', description: '', stickerIds: ['a'], createdAt: 0 },
      [{ id: 'a', name: 'Miss You' }],
    );
    const parsed = JSON.parse(json) as { format: string; stickers: { file: string }[] };
    expect(parsed.format).toBe('lovekit-sticker-pack');
    expect(parsed.stickers[0].file).toBe('sticker_01.png');
    expect(slug('Miss You ❤️ Über')).toBe('miss-you-uber');
  });
});
