# LoveKit E2EE Protocol v1 (draft — implemented in `src/lib/e2ee.ts`)

Private chat between two LoveKit IDs. The relay (Supabase) is **untrusted**:
it only ever sees `Envelope` objects (opaque ciphertext) and public keys.

## Crypto

- **ECDH P-256** (WebCrypto, all browsers; X25519 skipped — missing in some
  browsers, and P-256 is plenty here) → **HKDF-SHA256** → **AES-GCM-256**.
- Per-message random 96-bit IV. Fingerprint = SHA-256 hex of raw public key.
- Sender + recipient fingerprints are bound into both the HKDF `info` and the
  AES-GCM **additional data** — re-addressing a message breaks authentication.
- Plaintext cap 5000 chars. Empty rejected.

## Safety codes

`safetyCode(fpA, fpB)` = 3×2 digits from SHA-256 of sorted fingerprints,
e.g. `41-87-23`. Humans compare them once (in person / on a call) to rule
out a malicious relay swapping keys (MITM). **The UI must force this step
before the first real message** — an unverified key shows a persistent
"unverified" badge.

## Identities & IDs

- Keypair generated on first install; private key never leaves the device.
- Human ID: `adjective-noun-NN` (`moonlit-otter-42`), validated by `validId()`.
  Uniqueness enforced server-side (first-claim wins; collisions retry).
- No phone numbers, no emails, no OTP — the ID *is* the address.

## Envelope v1

```json
{ "v": 1, "from": "<fp>", "to": "<fp>", "iv": "<b64>", "ct": "<b64>", "ts": 123 }
```

- `ts` is a display hint only. Replays are killed by IV-uniqueness
  (`createReplayWindow`, 500-entry cap) — late delivery after days offline
  must still work, so timestamps are never a validity condition.

## Server contract (Supabase, to be built in Phase 3)

- `profiles(id PK, public_key JWK, owner auth.uid())` — public readable
  (public keys are public), writable only by owner.
- `inbox(id, to_id → profiles, envelope JSONB, created_at)` — insert by any
  authenticated user, select/delete only by owner (`to_id`'s owner).
- Anonymous auth (`signInAnonymously`) — no phone/email ever.
- Realtime on `inbox` for delivery; clients delete on receipt (server keeps
  undelivered ciphertext only).

## Out of scope for v1

Read receipts (off), typing indicators (no), group chat (no), attachment
encryption (cards/stickers travel as sealed envelopes later — same primitives).
