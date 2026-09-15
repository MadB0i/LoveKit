import { describe, expect, it } from 'vitest';
import { asSafeList, asSafeRecord, buildShareUrl, decodeShare, encodeShare } from '../src/lib/share';

describe('share links', () => {
  it('round-trips a card payload with unicode', () => {
    const code = encodeShare('card', { toName: 'Zoë 💕', message: 'Ünïcodé ♥ — “quoted” & <safe>' });
    const res = decodeShare(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.kind).toBe('card');
      expect((res.data as Record<string, string>).toName).toBe('Zoë 💕');
    }
  });

  it('rejects garbage, wrong kinds and oversized codes', () => {
    expect(decodeShare('')).toEqual({ ok: false, error: 'This link is empty.' });
    expect(decodeShare('!!!not-base64!!!').ok).toBe(false);
    expect(decodeShare('x'.repeat(200_001)).ok).toBe(false);
  });

  it('rejects tampered envelopes (bad version / kind)', () => {
    const good = encodeShare('coupon', { title: 'Hug' });
    // Flip the last char to corrupt the payload
    const bad = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A');
    expect(decodeShare(bad).ok).toBe(false);
  });

  it('builds hash-based URLs (static-host friendly)', () => {
    expect(buildShareUrl('ABC123')).toContain('#/l/ABC123');
  });

  it('sanitizes decoded records and lists', () => {
    const rec = asSafeRecord({ a: 'x'.repeat(5000), n: 42, bad: null, 'k!': 'v' });
    expect(rec.a.length).toBeLessThanOrEqual(2000);
    expect(rec.n).toBe('42');
    expect('bad' in rec).toBe(false);
    const list = asSafeList({ tags: ['a', 1, '', 'b'] }, 'tags');
    expect(list).toEqual(['a', 'b']);
  });
});
