/**
 * capsules.ts — time-capsule sealing.
 *
 * Threat model, stated honestly:
 * - The "locked" state is enforced in the UI: locked content is stored ONLY
 *   as ciphertext and the message is never rendered before `unlockAt`.
 * - With an optional passphrase, sealing uses AES-GCM (WebCrypto) with a
 *   PBKDF2-derived key — genuinely unreadable without the passphrase, even
 *   with devtools open.
 * - WITHOUT a passphrase we still encrypt with a random key that is kept in a
 *   SEPARATE localStorage entry (keyed by capsule id) — never inside the
 *   capsule record — so casual snooping / shoulder-surfing / full-text search
 *   won't surface the message. A determined local attacker with devtools CAN
 *   still find both halves on the same device. The UI says exactly this
 *   instead of promising "military-grade time-lock".
 * - Shared-link capsules are UI-locked until the date, but anyone who can
 *   decode base64 can read the words early. The UI warns the sender about
 *   this before sharing; for real secrecy, share in person after it unlocks.
 */

import type { TimeCapsule } from './types';
import { uid } from './store';
import { clampInt, cleanText } from './sanitize';

const enc = () => new TextEncoder();
const dec = () => new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hasCrypto(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

/** Public probe so the UI can warn when only the obfuscated fallback is available. */
export function isCapsuleCryptoAvailable(): boolean {
  try {
    return hasCrypto();
  } catch {
    return false;
  }
}

/* Separate key storage: prefers localStorage, falls back to memory (tests). */
const memKeys = new Map<string, string>();
function keySet(id: string, pass: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lovekit.capkey.${id}`, pass);
      return;
    }
  } catch {
    /* fall through to memory */
  }
  memKeys.set(id, pass);
}
function keyGet(id: string): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`lovekit.capkey.${id}`) || memKeys.get(id) || '';
    }
  } catch {
    /* fall through */
  }
  return memKeys.get(id) || '';
}

/** Store the key that arrived inside a shared link (link secrecy = security). */
export function importSharedKey(id: string, key: string): void {
  if (key) keySet(id, key);
}

/** Read the local key (used when sharing a passphrase-less capsule). */
export function exportLocalKey(id: string): string {
  return keyGet(id);
}

interface SealedEnvelope {
  v: 1;
  iv: string;
  ct: string;
  salt: string;
  iters: number;
}

async function deriveKey(pass: string, salt: Uint8Array, iters: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iters, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Seal a message. Returns the capsule (message NOT included in plaintext). */
export async function sealCapsule(opts: {
  title: string;
  message: string;
  unlockAt: number;
  hint?: string;
  passphrase?: string;
}): Promise<TimeCapsule> {
  const message = cleanText(opts.message, 5000);
  if (!message) throw new Error('Write your message first.');
  if (!Number.isFinite(opts.unlockAt) || opts.unlockAt <= Date.now()) {
    throw new Error('Pick a future unlock date.');
  }
  const hasPass = !!opts.passphrase;
  // Fallback for non-secure contexts (plain http, very old browsers):
  // an obfuscated — NOT encrypted — envelope. The UI warns about this.
  if (!hasCrypto()) {
    const sealed = JSON.stringify({
      v: 1,
      iv: '',
      ct: b64(enc().encode(message)),
      salt: '',
      iters: 0,
    } satisfies SealedEnvelope);
    return {
      id: uid('cap'),
      title: cleanText(opts.title, 120) || 'A note from the past',
      sealed: `plain1.${b64(enc().encode(sealed))}`,
      unlockAt: Math.floor(opts.unlockAt),
      hint: cleanText(opts.hint ?? '', 200) || undefined,
      hasPassphrase: false,
      createdAt: Date.now(),
    };
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const iters = 120_000;
  const pass = hasPass ? `pp:${opts.passphrase}` : `auto:${b64(randomBytes(32))}`;
  const key = await deriveKey(pass, salt, iters);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc().encode(message)),
  );
  const envelope: SealedEnvelope = {
    v: 1,
    iv: b64(iv),
    ct: b64(ct),
    salt: b64(salt),
    iters,
  };
  // Robust scheme: the envelope holds salt/iv/ciphertext; the auto passphrase
  // is persisted in a SEPARATE localStorage entry keyed by capsule id, so the
  // message never sits next to its key in one readable record.
  const id = uid('cap');
  if (!hasPass) {
    keySet(id, pass);
  }
  return {
    id,
    title: cleanText(opts.title, 120) || 'A note from the past',
    sealed: `aes1.${b64(enc().encode(JSON.stringify(envelope)))}`,
    unlockAt: Math.floor(opts.unlockAt),
    hint: cleanText(opts.hint ?? '', 200) || undefined,
    hasPassphrase: hasPass,
    createdAt: Date.now(),
  };
}

/** True when the capsule may be opened (date reached). */
export function isUnlocked(c: Pick<TimeCapsule, 'unlockAt'>, now = Date.now()): boolean {
  return now >= c.unlockAt;
}

/** Days/hours remaining, humanised. */
export function lockRemaining(unlockAt: number, now = Date.now()): string {
  const ms = unlockAt - now;
  if (ms <= 0) return 'unlocked';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `${days} days left`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 2) return `${hours} hours left`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins} min left`;
}

/**
 * Open a capsule. Enforces the date lock BEFORE touching crypto so locked
 * content is never decrypted early — even with the right passphrase.
 */
export async function unsealCapsule(c: TimeCapsule, passphrase = '', now = Date.now()): Promise<string> {
  if (!isUnlocked(c, now)) {
    throw new Error(`Still locked — ${lockRemaining(c.unlockAt, now)}. Good things take time. 🔒`);
  }
  const [tag, payload] = c.sealed.split('.', 2);
  if (!payload) throw new Error('This capsule is damaged.');
  let env: SealedEnvelope;
  try {
    env = JSON.parse(dec().decode(unb64(payload))) as SealedEnvelope;
  } catch {
    throw new Error('This capsule is damaged.');
  }
  if (tag === 'plain1') {
    return dec().decode(unb64(env.ct));
  }
  if (tag !== 'aes1') throw new Error('Unknown capsule format.');
  // `iters` arrives inside a potentially attacker-crafted envelope (shared
  // links). Clamp it: absurd values would either DoS the receiver's CPU
  // (10M PBKDF2 rounds) or silently weaken derivation.
  const iters = clampInt(env.iters, 1, 500_000, 120_000);
  let pass: string;
  if (c.hasPassphrase) {
    if (!passphrase) throw new Error('This capsule needs its passphrase.');
    pass = `pp:${passphrase}`;
  } else {
    pass = keyGet(c.id);
    if (!pass) throw new Error('The key for this capsule is gone (it lived only on the device that sealed it).');
  }
  if (!hasCrypto()) throw new Error('This device cannot unlock capsules.');
  try {
    const key = await deriveKey(pass, unb64(env.salt), iters);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(env.iv) as BufferSource },
      key,
      unb64(env.ct) as BufferSource,
    );
    return dec().decode(pt);
  } catch {
    throw new Error(c.hasPassphrase ? 'Wrong passphrase. Try again gently. ❤️' : 'Could not unlock this capsule.');
  }
}
