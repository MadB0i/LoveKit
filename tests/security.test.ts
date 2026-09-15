import { afterEach, describe, expect, it } from 'vitest';
import { CustomEndpointProvider } from '../src/lib/ai';
import { guesserVote } from '../src/games/whoSaidIt';
import { clampInt, isRasterImageDataUrl } from '../src/lib/sanitize';
import { asSafeRecord, decodeShare, encodeShare } from '../src/lib/share';

/** Hand-rolled base64url (no Node types needed — works in browser too). */
function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function craft(payload: unknown): string {
  return b64url(JSON.stringify(payload));
}

describe('hostile share links', () => {
  it('rejects unknown kinds, future versions, bad JSON, truncation', () => {
    expect(decodeShare(craft({ v: 1, kind: 'admin', data: {}, createdAt: 1 })).ok).toBe(false);
    expect(decodeShare(craft({ v: 999, kind: 'card', data: {}, createdAt: 1 })).ok).toBe(false);
    expect(decodeShare(craft({ v: 1, kind: 'card', data: {}, createdAt: 'yesterday' })).ok).toBe(false);
    expect(decodeShare(b64url('this is not json'))).toEqual(
      expect.objectContaining({ ok: false }),
    );
    const good = encodeShare('card', { message: 'hi' });
    expect(decodeShare(good.slice(0, Math.floor(good.length / 2))).ok).toBe(false);
    expect(decodeShare('!!! /// ???').ok).toBe(false);
  });

  it('rejects oversized payloads (the ~150 KB cap is real)', () => {
    const big = encodeShare('card', { message: 'x'.repeat(160_000) });
    expect(big.length).toBeGreaterThan(150_000);
    expect(decodeShare(big)).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  it('ignores nested objects, arrays and repeated fields without crashing', () => {
    const res = decodeShare(
      craft({
        v: 1,
        kind: 'card',
        data: {
          message: 'real',
          nested: { deep: { deeper: [1, 2, { evil: true }] } },
          list: [1, 2, 3],
          message2: 'x',
        },
        createdAt: 1,
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const rec = asSafeRecord(res.data);
      expect(rec.message).toBe('real');
      expect('nested' in rec).toBe(false);
      expect('list' in rec).toBe(false);
    }
  });

  it('does not allow prototype pollution via crafted keys', () => {
    const res = decodeShare(
      craft({
        v: 1,
        kind: 'card',
        data: { __proto__: { polluted: true }, constructor: 'x', prototype: 'y', message: 'ok' },
        createdAt: 1,
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected valid envelope');
    const rec = asSafeRecord(res.data);
    // NOTE: `'__proto__' in rec` is ALWAYS true via the prototype chain —
    // the meaningful assertions are own-property absence + no pollution.
    expect(Object.hasOwn(rec, '__proto__')).toBe(false);
    expect(Object.hasOwn(rec, 'constructor')).toBe(false);
    expect(Object.hasOwn(rec, 'prototype')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(rec.message).toBe('ok');
  });

  it('unicode, emoji and 10k-char messages round-trip and stay bounded', () => {
    const msg = '❤️'.repeat(2000) + 'Ünïcodé “quotes” <tags> & ampersands';
    const res = decodeShare(encodeShare('card', { message: msg }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      const rec = asSafeRecord(res.data, 2000);
      expect(rec.message.length).toBeLessThanOrEqual(2000);
      expect(rec.message).toContain('❤️');
    }
  });
});

describe('raster image gate', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  it('accepts raster uploads, rejects SVG and sneaky schemes', () => {
    expect(isRasterImageDataUrl(png)).toBe(true);
    expect(isRasterImageDataUrl('DATA:IMAGE/JPEG;BASE64,/9j/4AAQ')).toBe(true);
    expect(isRasterImageDataUrl('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==')).toBe(false);
    expect(isRasterImageDataUrl('data:text/html;base64,PGI+')).toBe(false);
    expect(isRasterImageDataUrl('javascript:alert(1)')).toBe(false);
    expect(isRasterImageDataUrl('data:image/png;base64,')).toBe(false);
    expect(isRasterImageDataUrl('data:image/png;base64,***not-b64***')).toBe(false);
    expect(isRasterImageDataUrl('')).toBe(false);
  });
});

describe('writer-frame vote mapping (regression: inverted scores)', () => {
  it('maps guesser taps into the writer frame of reference', () => {
    // Guesser taps "ME" (themselves) → in writer-frame that's 'you'.
    expect(guesserVote(true)).toBe('you');
    // Guesser taps "YOU" (the writer) → writer-frame 'me'.
    expect(guesserVote(false)).toBe('me');
  });
});

describe('clampInt (used to bound untrusted crypto params)', () => {
  it('clamps and falls back', () => {
    expect(clampInt(10_000_000, 1, 500_000, 120_000)).toBe(500_000);
    expect(clampInt(-5, 1, 500_000, 120_000)).toBe(1);
    expect(clampInt(Number.NaN, 1, 500_000, 120_000)).toBe(120_000);
    expect(clampInt('x', 1, 500_000, 120_000)).toBe(120_000);
    expect(clampInt(120_000, 1, 500_000, 0)).toBe(120_000);
  });
});

describe('BYO endpoint hardening', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function stub(text: string, ok = true): void {
    globalThis.fetch = (async () => ({ ok, status: ok ? 200 : 500, text: async () => text })) as unknown as typeof fetch;
  }

  it('refuses non-https endpoints', async () => {
    const p = new CustomEndpointProvider('http://evil.local/chat', 'k');
    await expect(p.transform({ text: 'hi', tone: 'shorter' })).rejects.toThrow(/https/);
  });

  it('rejects malformed endpoint JSON and empty content', async () => {
    stub('not json at all {{{');
    const p = new CustomEndpointProvider('https://ai.example/chat', 'k');
    await expect(p.transform({ text: 'hi', tone: 'shorter' })).rejects.toThrow(/unreadable/);
    stub(JSON.stringify({ choices: [] }));
    await expect(p.transform({ text: 'hi', tone: 'shorter' })).rejects.toThrow(/nothing/);
  });

  it('caps absurd response bodies before parsing', async () => {
    stub(`{"choices":[{"message":{"content":"${'A'.repeat(200_000)}"}}]}`);
    const p = new CustomEndpointProvider('https://ai.example/chat', 'k');
    // 50k cap slices mid-JSON → must fail closed, not allocate-and-render.
    await expect(p.transform({ text: 'hi', tone: 'shorter' })).rejects.toThrow();
  });

  it('accepts a well-formed small response', async () => {
    stub(JSON.stringify({ choices: [{ message: { content: '  Warmer words  ' } }] }));
    const p = new CustomEndpointProvider('https://ai.example/chat', 'k');
    await expect(p.transform({ text: 'hi', tone: 'warmer' })).resolves.toBe('Warmer words');
  });
});
