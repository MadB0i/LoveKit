import { describe, expect, it } from 'vitest';
import { isUnlocked, lockRemaining, sealCapsule, unsealCapsule } from '../src/lib/capsules';

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
});
