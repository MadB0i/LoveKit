# Contributing to LoveKit ❤️

Thanks for helping humans love each other better. LoveKit is a real product
with real users (couples!), so contributions should be **working, tested and
tasteful** — no placeholders, no fake buttons, no “coming soon”.

## Ground rules

- **Privacy first:** no new network calls, trackers, or third-party scripts
  without an explicit discussion. Photos stay on-device.
- **No AI-partner creep:** never add features where the AI roleplays as a
  lover, scores compatibility, or judges “true love”.
- **Mobile-first + accessible:** touch targets ≥ 38px, visible focus states,
  semantic HTML, `prefers-reduced-motion` respected (helpers in
  `src/components/Effects.tsx`).
- **Quality gates must pass:** `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run build`.

## Most-wanted contributions (one file each!)

### 1. A new game
1. `src/games/myGame.ts` — content + **pure** scoring functions (no React).
2. `src/pages/games/MyGame.tsx` — UI (copy `ThisOrThat.tsx` as a skeleton).
3. Register in `src/games/registry.ts`, add a route in `src/App.tsx`.
4. Tests in `tests/` for the scoring.

### 2. A new card theme
Append to `THEMES` in `src/data/themes.ts`:
`{ id, name, blurb, bg: [c1, c2], ink, muted, accent, glow, font, pattern }`.
Keep it sophisticated — warm and premium, not candy-pink.

### 3. Message starters
Append to `TEMPLATES` in `src/data/templates.ts` with `{{partner}}` /
`{{sender}}` placeholders. Specific beats sweeping: one true detail beats
ten adjectives. Never generic cringe.

### 4. Translations (`/locales` — planned)
Copy the English strings module pattern once it lands; keep tone warm.

## Sticker / WhatsApp work

Specs live in `src/lib/whatsapp.ts` (512×512, transparent, <100 KB,
tray 96×96, 3–30 per pack). The web app **must not** claim a native “Add to
WhatsApp” it doesn’t have — keep the import guide honest. The `pack.json`
manifest is the contract a future Android wrapper will consume; don’t break
its shape without discussion.

## Time-capsule crypto

`src/lib/capsules.ts` documents its own threat model. Don’t weaken it:
UI-lock before crypto, never render locked content, keep the passphrase path
genuinely end-to-end (key in the user’s head, nowhere else).

## Pull requests

- Small and focused; describe the couple-moment it enables.
- Include before/after screenshots for UI changes (mobile width!).
- Update the README feature table if you add a user-facing feature.
