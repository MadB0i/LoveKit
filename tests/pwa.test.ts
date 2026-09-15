import { afterEach, describe, expect, it } from 'vitest';
import { checkImageFile } from '../src/lib/images';
import {
  parseInboundShare,
  shouldRegisterSW,
  takeInboundShare,
  INBOUND_SHARE_KEY,
} from '../src/lib/pwa';

function stubSession(): Map<string, string> {
  const mem = new Map<string, string>();
  (globalThis as unknown as Record<string, unknown>).sessionStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };
  return mem;
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).sessionStorage;
});

describe('service worker registration gate', () => {
  it('never registers in non-production runtimes', () => {
    expect(shouldRegisterSW()).toBe(false); // vitest sets NODE_ENV=test, PROD=false
  });
});

describe('inbound share-target parsing', () => {
  it('parses title/text/url and drops unsafe URLs', () => {
    expect(parseInboundShare('?title=Hi&text=Hello+you&url=https%3A%2F%2Fexample.com%2Fx')).toEqual({
      title: 'Hi',
      text: 'Hello you',
      url: 'https://example.com/x',
    });
    expect(parseInboundShare('?url=javascript%3Aalert(1)&text=hi')).toEqual({ title: '', text: 'hi', url: '' });
    expect(parseInboundShare('')).toBeNull();
    expect(parseInboundShare('?foo=bar')).toBeNull();
    expect(parseInboundShare('???')).toBeNull();
  });

  it('caps field lengths', () => {
    const p = parseInboundShare(`?text=${'a'.repeat(5000)}&title=${'b'.repeat(500)}`);
    expect(p?.text).toHaveLength(2000);
    expect(p?.title).toHaveLength(120);
  });

  it('takeInboundShare is read-once and expires', () => {
    const mem = stubSession();
    expect(takeInboundShare()).toBeNull();
    mem.set(INBOUND_SHARE_KEY, JSON.stringify({ title: 'T', text: 'hi', url: '', at: Date.now() }));
    expect(takeInboundShare()).toEqual({ title: 'T', text: 'hi', url: '' });
    expect(mem.has(INBOUND_SHARE_KEY)).toBe(false); // consumed
    mem.set(INBOUND_SHARE_KEY, JSON.stringify({ title: '', text: 'old', url: '', at: Date.now() - 20 * 60_000 }));
    expect(takeInboundShare()).toBeNull();
    mem.set(INBOUND_SHARE_KEY, 'corrupt{{{');
    expect(takeInboundShare()).toBeNull();
  });
});

describe('image upload guard', () => {
  const blob = (type: string, size: number) => new Blob([new Uint8Array(size)], { type });
  it('rejects non-images, empties and monsters; accepts sane photos', () => {
    expect(checkImageFile(blob('text/plain', 100))).toMatch(/not an image/);
    expect(checkImageFile(blob('image/png', 0))).toMatch(/empty|corrupt/);
    expect(checkImageFile(blob('image/jpeg', 26 * 1024 * 1024))).toMatch(/huge|25 MB/);
    expect(checkImageFile(blob('image/webp', 3 * 1024 * 1024))).toBeNull();
  });
});
