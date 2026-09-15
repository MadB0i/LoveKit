/**
 * e2ee.ts — LoveKit end-to-end encryption, protocol v1.
 *
 * Design (see docs/e2ee-protocol.md):
 * - ECDH P-256 + HKDF-SHA256 + AES-GCM-256, all WebCrypto, zero dependencies.
 * - Why P-256 and not X25519: WebCrypto X25519 is still missing in some
 *   browsers; P-256 ECDH works everywhere LoveKit runs (web + Android later).
 * - Sender identity and recipient are BOUND into the AES-GCM additional data,
 *   so a relay cannot re-address a message without breaking authentication.
 * - Fingerprints + numeric safety codes let two humans verify keys face to
 *   face (or over a call) and kill man-in-the-middle attacks.
 *
 * This module never touches the network. The relay (Supabase) will only ever
 * see `Envelope` objects — opaque ciphertext.
 */

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const AES = 'AES-GCM';
const PROTOCOL = 'lovekit-e2ee-v1';

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

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Identity {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  /** Hex SHA-256 of the raw public key — the thing safety codes derive from. */
  fingerprint: string;
}

/** Fresh identity. Private key must never leave the device. */
export async function generateIdentity(): Promise<Identity> {
  const pair = (await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, fingerprint: await sha256Hex(raw) };
}

/** Import a previously exported public key (JWK from the directory). */
export async function importPublicKey(jwk: JsonWebKey): Promise<{ key: CryptoKey; fingerprint: string }> {
  const key = await crypto.subtle.importKey('jwk', jwk, ECDH, true, []);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return { key, fingerprint: await sha256Hex(raw) };
}

export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key) as Promise<JsonWebKey>;
}

async function messageKey(ours: CryptoKey, theirs: CryptoKey, fromFp: string, toFp: string): Promise<CryptoKey> {
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, ours, 256);
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(`${PROTOCOL}|salt`),
      info: enc.encode(`${PROTOCOL}|msg|${fromFp}|${toFp}`),
    },
    base,
    { name: AES, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function associatedData(fromFp: string, toFp: string): Uint8Array {
  return new TextEncoder().encode(`${PROTOCOL}|${fromFp}|${toFp}`);
}

export interface Envelope {
  v: 1;
  from: string; // sender fingerprint
  to: string; // recipient fingerprint
  iv: string; // base64, 96-bit
  ct: string; // base64
  ts: number; // sender ms epoch
}

/** Seal a message. Throws on empty plaintext. */
export async function sealEnvelope(
  sender: Identity,
  recipientPublic: CryptoKey,
  recipientFp: string,
  plaintext: string,
): Promise<Envelope> {
  const clean = plaintext.trim();
  if (!clean) throw new Error('Nothing to send.');
  if (clean.length > 5000) throw new Error('Message too long.');
  const key = await messageKey(sender.privateKey, recipientPublic, sender.fingerprint, recipientFp);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: AES, iv: iv as BufferSource, additionalData: associatedData(sender.fingerprint, recipientFp) as BufferSource },
      key,
      new TextEncoder().encode(clean),
    ),
  );
  return { v: 1, from: sender.fingerprint, to: recipientFp, iv: b64(iv), ct: b64(ct), ts: Date.now() };
}

/** Open a message. Any tampering (ct, iv, from, to) fails closed. */
export async function openEnvelope(recipient: Identity, senderPublic: CryptoKey, env: Envelope): Promise<string> {
  if (env.v !== 1) throw new Error('Unknown envelope version.');
  if (!env.from || !env.to || !env.iv || !env.ct) throw new Error('Damaged envelope.');
  const key = await messageKey(recipient.privateKey, senderPublic, env.from, env.to);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: AES, iv: unb64(env.iv) as BufferSource, additionalData: associatedData(env.from, env.to) as BufferSource },
      key,
      unb64(env.ct) as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('Could not open this message (wrong key or tampered).');
  }
}

/**
 * Numeric safety code from two fingerprints, order-independent.
 * Humans compare these ("41-87-23?") to rule out man-in-the-middle.
 */
export async function safetyCode(fpA: string, fpB: string): Promise<string> {
  const [a, b] = [fpA, fpB].sort();
  const hex = await sha256Hex(new TextEncoder().encode(`${PROTOCOL}|sas|${a}|${b}`));
  const groups: string[] = [];
  for (let i = 0; i < 3; i++) {
    groups.push(String(parseInt(hex.slice(i * 4, i * 4 + 4), 16) % 100).padStart(2, '0'));
  }
  return groups.join('-');
}

/* ---------------- LoveKit IDs ---------------- */

const ID_ADJECTIVES = [
  'lovely', 'snuggly', 'dreamy', 'honey', 'cozy', 'starry', 'velvet', 'sunny',
  'moonlit', 'giggly', 'tender', 'lucky', 'magic', 'sweet', 'gentle', 'golden',
  'midnight', 'peachy', 'brave', 'fizzy',
];
const ID_NOUNS = [
  'tiger', 'panda', 'sparrow', 'peach', 'muffin', 'comet', 'otter', 'biscuit',
  'willow', 'fox', 'mochi', 'river', 'robin', 'cookie', 'breeze', 'bear',
  'plum', 'cloud', 'song', 'ember',
];

/** Human-typable ID, e.g. `moonlit-otter-42`. Uniqueness is enforced server-side. */
export function suggestId(): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(ID_ADJECTIVES)}-${pick(ID_NOUNS)}-${10 + Math.floor(Math.random() * 90)}`;
}

export function validId(id: string): boolean {
  return /^[a-z]+-[a-z]+-\d{2}$/.test(id) && id.length <= 40;
}

/* ---------------- replay window ---------------- */

const REPLAY_CAP = 500;

/**
 * Replay gate for incoming envelopes: each IV is accepted exactly once.
 * Deliberately NOT timestamp-based — store-and-forward delivery means a
 * legitimate message can arrive days late (partner was offline), and sender
 * clocks can't be trusted anyway. Timestamps are display hints only.
 */
export function createReplayWindow() {
  const seen = new Set<string>();
  const order: string[] = [];
  return {
    isFresh(env: Pick<Envelope, 'iv'>): boolean {
      if (!env.iv || typeof env.iv !== 'string') return false;
      if (seen.has(env.iv)) return false;
      seen.add(env.iv);
      order.push(env.iv);
      if (order.length > REPLAY_CAP) {
        const old = order.shift();
        if (old) seen.delete(old);
      }
      return true;
    },
  };
}
