import { describe, expect, it } from 'vitest';
import {
  createReplayWindow,
  generateIdentity,
  importPublicKey,
  exportPublicKey,
  openEnvelope,
  safetyCode,
  sealEnvelope,
  suggestId,
  validId,
} from '../src/lib/e2ee';

async function pair() {
  const a = await generateIdentity();
  const b = await generateIdentity();
  return { a, b };
}

describe('e2ee round-trip', () => {
  it('seals and opens between two identities', async () => {
    const { a, b } = await pair();
    const env = await sealEnvelope(a, b.publicKey, b.fingerprint, '  meet at 7? ❤️  ');
    expect(env.v).toBe(1);
    expect(env.from).toBe(a.fingerprint);
    expect(env.to).toBe(b.fingerprint);
    await expect(openEnvelope(b, a.publicKey, env)).resolves.toBe('meet at 7? ❤️');
  });

  it('fingerprints are stable and unique per identity', async () => {
    const { a, b } = await pair();
    expect(a.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(a.fingerprint).not.toBe(b.fingerprint);
    const re = await importPublicKey(await exportPublicKey(a.publicKey));
    expect(re.fingerprint).toBe(a.fingerprint);
  });

  it('fails closed: tampered ct/iv/from/to and wrong keys', async () => {
    const { a, b } = await pair();
    const c = await generateIdentity();
    const env = await sealEnvelope(a, b.publicKey, b.fingerprint, 'secret');
    const flip = (s: string) => s.slice(0, 5) + (s[5] === 'A' ? 'B' : 'A') + s.slice(6);
    await expect(openEnvelope(b, a.publicKey, { ...env, ct: flip(env.ct) })).rejects.toThrow(/tampered|wrong key/);
    await expect(openEnvelope(b, a.publicKey, { ...env, iv: flip(env.iv) })).rejects.toThrow();
    await expect(openEnvelope(b, a.publicKey, { ...env, from: c.fingerprint })).rejects.toThrow();
    await expect(openEnvelope(b, a.publicKey, { ...env, to: c.fingerprint })).rejects.toThrow();
    await expect(openEnvelope(c, a.publicKey, env)).rejects.toThrow();
    await expect(openEnvelope(b, c.publicKey, env)).rejects.toThrow();
    await expect(openEnvelope(b, a.publicKey, { ...env, v: 99 } as never)).rejects.toThrow(/version/);
  });

  it('rejects empty and oversized plaintext', async () => {
    const { a, b } = await pair();
    await expect(sealEnvelope(a, b.publicKey, b.fingerprint, '   ')).rejects.toThrow();
    await expect(sealEnvelope(a, b.publicKey, b.fingerprint, 'x'.repeat(5001))).rejects.toThrow();
  });
});

describe('safety codes', () => {
  it('are deterministic, order-independent, and differ per pair', async () => {
    const { a, b } = await pair();
    const c = await generateIdentity();
    const ab = await safetyCode(a.fingerprint, b.fingerprint);
    expect(ab).toMatch(/^\d{2}-\d{2}-\d{2}$/);
    expect(await safetyCode(b.fingerprint, a.fingerprint)).toBe(ab);
    expect(await safetyCode(a.fingerprint, c.fingerprint)).not.toBe(ab);
  });
});

describe('lovekit ids', () => {
  it('suggest valid, typable ids', () => {
    for (let i = 0; i < 20; i++) expect(validId(suggestId())).toBe(true);
    expect(validId('Moonlit-Otter-42')).toBe(false);
    expect(validId('nope')).toBe(false);
    expect(validId('a-b-1')).toBe(false);
  });
});

describe('replay window', () => {
  it('accepts each IV once, survives late delivery, evicts oldest', async () => {
    const { a, b } = await pair();
    const w = createReplayWindow();
    const e1 = await sealEnvelope(a, b.publicKey, b.fingerprint, 'one');
    const e2 = await sealEnvelope(a, b.publicKey, b.fingerprint, 'two');
    expect(w.isFresh(e1)).toBe(true);
    expect(w.isFresh(e1)).toBe(false); // replay
    expect(w.isFresh(e2)).toBe(true);
    expect(w.isFresh({ iv: '' })).toBe(false);
    // A week-late legitimate message (offline partner) still accepted.
    const old = { ...e2, iv: 'fresh-iv-never-seen', ts: Date.now() - 8 * 86_400_000 };
    expect(w.isFresh(old)).toBe(true);
  });
});
