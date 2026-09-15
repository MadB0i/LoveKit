import { describe, expect, it } from 'vitest';
import { exportLocalKey, isUnlocked, lockRemaining, sealCapsule, unsealCapsule } from '../src/lib/capsules';
import { buildShareUrl, decodeShare, encodeShare } from '../src/lib/share';

describe('time capsules', () => {
  it('stays locked before the date — even the seal never holds plaintext', async () => {
    const cap = await sealCapsule({
      title: 'Future us',
      message: 'Remember the monsoon drive?',
      unlockAt: Date.now() + 86_400_000,
    });
    expect(isUnlocked(cap)).toBe(false);
    expect(lockRemaining(cap.unlockAt)).toContain('left');
    expect(cap.sealed).not.toContain('monsoon');
    await expect(unsealCapsule(cap)).rejects.toThrow(/Still locked/);
  });

  it('opens after the unlock date (no passphrase)', async () => {
    const cap = await sealCapsule({ title: 'Hi', message: 'We made it ♥', unlockAt: Date.now() + 50 });
    await new Promise((r) => setTimeout(r, 70));
    await expect(unsealCapsule(cap)).resolves.toBe('We made it ♥');
  });

  it('passphrase capsules need the right words', async () => {
    const cap = await sealCapsule({
      title: 'Secret',
      message: 'passionfruit',
      unlockAt: Date.now() + 30,
      passphrase: 'our-song-lyric',
    });
    expect(cap.hasPassphrase).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    await expect(unsealCapsule(cap, 'wrong')).rejects.toThrow(/passphrase/i);
    await expect(unsealCapsule(cap, 'our-song-lyric')).resolves.toBe('passionfruit');
  });

  it('rejects empty messages and past dates', async () => {
    await expect(sealCapsule({ title: 'x', message: '   ', unlockAt: Date.now() + 1000 })).rejects.toThrow();
    await expect(sealCapsule({ title: 'x', message: 'hi', unlockAt: Date.now() - 1000 })).rejects.toThrow();
  });

  it('detects tampering: flipped ciphertext fails closed with a friendly error', async () => {
    const cap = await sealCapsule({ title: 'Hi', message: 'untouched ♥', unlockAt: Date.now() + 30 });
    await new Promise((r) => setTimeout(r, 60));
    // Tamper with the OUTER envelope (corrupt base64/JSON).
    const outer = { ...cap, sealed: `${cap.sealed.slice(0, 8)}!${cap.sealed.slice(9)}` };
    await expect(unsealCapsule(outer)).rejects.toThrow(/damaged/);
    // Tamper with the INNER ciphertext (breaks the GCM auth tag).
    const [, payload] = cap.sealed.split('.', 2);
    const bin = atob(payload);
    const env = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    const ct: string = env.ct;
    env.ct = ct.slice(0, 10) + (ct[10] === 'A' ? 'B' : 'A') + ct.slice(11);
    const re = btoa(new TextEncoder().encode(JSON.stringify(env)).reduce((s, b) => s + String.fromCharCode(b), ''));
    await expect(unsealCapsule({ ...cap, sealed: `aes1.${re}` })).rejects.toThrow(/Could not unlock/);
    // And the untouched capsule still opens.
    await expect(unsealCapsule(cap)).resolves.toBe('untouched ♥');
  });

  it('rejects unknown envelope tags', async () => {
    const cap = await sealCapsule({ title: 'Hi', message: 'x', unlockAt: Date.now() + 30 });
    await new Promise((r) => setTimeout(r, 60));
    await expect(unsealCapsule({ ...cap, sealed: 'zzz.QUJD' })).rejects.toThrow(/Unknown|damaged/);
    await expect(unsealCapsule({ ...cap, sealed: 'no-separator-here' })).rejects.toThrow(/damaged/);
  });

  it('RED TEAM: a passphrase-protected share link leaks zero plaintext', async () => {
    const secret = 'redteam-monsson-drive-secret';
    const cap = await sealCapsule({
      title: 'Future us',
      message: secret,
      unlockAt: Date.now() + 86_400_000,
      passphrase: 'our-song-lyric',
    });
    // Exactly what Capsules.tsx puts into a share link (no key — receiver
    // must know the passphrase).
    const code = encodeShare('capsule', {
      id: cap.id,
      title: cap.title,
      sealed: cap.sealed,
      unlockAt: String(cap.unlockAt),
      hint: '',
      hasPassphrase: '1',
    });
    const url = buildShareUrl(code);
    expect(url).not.toContain(secret);
    expect(url).not.toContain(encodeURIComponent(secret));
    const res = decodeShare(code);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('decode failed');
    const blob = JSON.stringify(res.data);
    expect(blob).not.toContain(secret);
    // And the sealed blob alone cannot be opened without the passphrase,
    // even past the unlock date.
    const opened = { ...cap, unlockAt: Date.now() - 1000 };
    await expect(unsealCapsule(opened, 'wrong-guess')).rejects.toThrow(/passphrase/i);
    await expect(unsealCapsule(opened, '')).rejects.toThrow(/passphrase/i);
  });

  it('RED TEAM documents the no-passphrase trade-off honestly', async () => {
    const cap = await sealCapsule({ title: 'Hi', message: 'open-secret', unlockAt: Date.now() + 50 });
    // Without a passphrase the key lives on the sender device; the share
    // flow re-exports it (link secrecy = security — UI says exactly this).
    const key = exportLocalKey(cap.id);
    expect(key.startsWith('auto:')).toBe(true);
    const code = encodeShare('capsule', { id: cap.id, sealed: cap.sealed, key });
    const res = decodeShare(code);
    expect(res.ok).toBe(true);
  });
});
