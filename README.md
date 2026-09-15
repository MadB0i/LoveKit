# LoveKit ❤️

**The open-source toolkit for meaningful relationships.**
*Build moments, not algorithms.*

LoveKit helps **two real people** communicate, celebrate, play and remember —
love cards, WhatsApp stickers, couple games, memories, coupons, time capsules
and gift-wrapped share links. No AI girlfriend. No compatibility scores.
No accounts. Everything runs on your device.

## ✨ Features (V1 — all working, no placeholders)

| Feature | What it does |
|---|---|
| 💌 **Love card studio** | 14 occasions, 24 heartfelt starters, 8 themes, hearts/confetti/sparkles/typewriter animations, optional photo + music-box tune, PNG download (1080×1350), share link |
| 😍 **WhatsApp Sticker Maker** | Photo/text/emoji/heart layers, drag · rotate · scale, undo/redo, transparent 512×512 PNG + WebP export, 96px tray icon, 3–30 sticker packs with portable `pack.json` manifest + honest import guide |
| 🎮 **3 couple games** | *How Well Do You Know Me?*, *Who Said It?*, *This-or-That* — pass-and-play with handoff screens, forgiving scoring, shareable challenges |
| 📸 **Memories** | Private timeline with photos, dates, places, tags, search |
| 🎟️ **Coupons** | “1 Free Hug”, “You Pick Dinner”… 5 designs, codes, expiry, redeem tracking |
| ⏳ **Time capsules** | AES-GCM sealed messages (optional passphrase), UI date-lock, countdown, honest threat model |
| 🔗 **Surprise links** | `…#/l/ABC123` gift-wrapped reveals for cards, stickers, packs, games, memories, coupons, capsules — no account needed |
| ✨ **Writing helper** | Offline tone polish (shorter/warmer/playful/calmer), guided 4-step apology composer, discussion starters, optional BYO AI endpoint (key stays in your browser) |

## 🚀 Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Production build (static — deploy anywhere, no server needed):

```bash
npm run build    # → dist/
npm run preview
```

### Deploying securely

`dist/` is plain static files. On your host, send these headers (example uses
Netlify `_headers` syntax — the values work on any host):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Deliberately **no** `Content-Security-Policy` meta tag ships in the app: an
incorrect inline CSP would brick every install with no recovery path, and the
app is already XSS-safe by construction (React-escaped rendering, validated
share-link decoding, raster-only untrusted images). If you add a CSP at the
host level, allow `img-src data: blob:`, keep `script-src 'self'`, and test
every page — including a received share link — before shipping it.

> **GitHub Pages** cannot send custom headers (platform limitation) — the app
> is still safe there by construction, and the service worker works fine.
> Headers above apply when you host on Netlify/Vercel/Cloudflare/your own
> server.

### Deploying to GitHub Pages

```bash
npm run build
# Publish the contents of dist/ — e.g. with the official
# peaceiris/actions-gh-pages action, or:
npx gh-pages -d dist   # (install gh-pages locally first)
```

No rewrites or fallbacks needed: hash routing (`#/cards`, `#/l/…`) works from
any static path, and the start URL resolves relative to wherever you host it.

## 📲 PWA — installable, offline-first

LoveKit ships a real Web App Manifest + service worker (zero new
dependencies, zero analytics):

- **Install:** Chromium (Android/desktop) shows a subtle, dismissible
  “Install LoveKit” card on the home page. iPhone: Share → *Add to Home
  Screen* (same card explains it). Dismissal is remembered; it never nags.
- **Offline:** after the first online load, the whole studio works offline —
  cards, stickers, games, memories, coupons, capsules, settings. An unobtrusive
  banner says so. Only the optional custom AI endpoint needs internet.
- **Updates:** new releases show an “Update now” bar; one tap swaps the worker.
- **Privacy:** the worker caches the *app shell only* (HTML/JS/CSS/icons).
  Share-link payloads live in the URL hash (never sent anywhere) and capsules
  stay ciphertext in localStorage — neither ever enters the cache.

### Share Target (inbound)

The manifest declares a **GET** share target (`title`/`text`/`url`). Sharing
text or a link from Android into installed LoveKit opens the Card Studio with
your words pre-filled. Honest limits: **files are not declared** — receiving
shared *files* needs a POST endpoint, which static hosting cannot provide.
That (plus one-tap WhatsApp import) is exactly what the future native wrapper
is for. Unsupported/corrupt/huge inputs are rejected with friendly messages;
uploads over 25 MB are refused before decoding to protect low-end phones.

### Browser compatibility

| Feature | Chrome/Edge (Android+desktop) | Firefox | Safari (iOS/macOS) |
|---|---|---|---|
| App + share links | ✅ | ✅ | ✅ |
| Install prompt | ✅ automatic | ✅ manual* | ✅ via Share menu |
| Service worker / offline | ✅ | ✅ | ✅ (16.4+) |
| Share-target text intake | ✅ Android | ❌ | ❌ |
| Sticker PNG/WebP export | ✅ | ✅ | ✅ (WebP export falls back to PNG where unsupported) |
| WebCrypto capsules | ✅ | ✅ | ✅ (secure contexts) |

\* Firefox: install via address-bar/menu “Install”. Capsules sealed on plain
`http://` (non-localhost) fall back to hidden-not-encrypted mode with an
explicit in-app warning.

Quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run pwa:verify   # manifest, icons, service worker, dist output
```

## 🏗️ Architecture

```
src/
  lib/        store.ts (localStorage) · share.ts (link codec) · sanitize.ts
              images.ts (on-device compress) · capsules.ts (AES-GCM sealing)
              cardExport.ts · stickerRender.ts · whatsapp.ts (specs+manifest)
              ai.ts (swappable writing providers) · music.ts (WebAudio lullaby)
  data/       themes.ts · templates.ts        ← contributors start here
  games/      registry.ts + knowMe.ts + whoSaidIt.ts + thisOrThat.ts
  components/ Layout · CardPreview · Effects · WritingHelper · ShareBox
              InstallPrompt · ErrorBoundary
  pages/      Home · Cards · Stickers · Games + games/* · Memories
              Coupons · Capsules · Receive (gift unwrap) · Privacy
  lib/…       pwa.ts (SW register, install, inbound share, online status)
  public/     manifest.webmanifest · sw.js · icons · favicon
  scripts/    gen-icons.mjs (dep-free icon renderer) · verify-pwa.mjs
tests/        share · sanitize · games · capsules · ai-stickers · security
              storage · pwa · pack-schema
```

**Key decisions:** local-first (no backend to hack, host, or pay for); hash
routing so share links work on any static host; one canvas painter shared by
the sticker preview *and* exports (WYSIWYG); pure game-logic modules that are
trivially testable; share payloads re-validated on decode and rendered as text
only (XSS-safe by construction).

### Adding a new game (~15 minutes)

1. Create `src/games/myGame.ts` — questions + **pure** scoring functions.
2. Create `src/pages/games/MyGame.tsx` — the UI (copy `ThisOrThat.tsx`).
3. Register in `src/games/registry.ts` + one route in `src/App.tsx`.
4. Add tests in `tests/`. That’s it — nothing else needs to change.

### Adding a theme / message template

Append one object to `THEMES` in `src/data/themes.ts` (bg gradient, ink,
accent, font, pattern) or one starter to `TEMPLATES` in
`src/data/templates.ts` (`{{partner}}` / `{{sender}}` placeholders supported).

### Sticker Maker architecture

Editor state → `renderSticker(ctx, sticker)` → preview canvas, PNG/WebP
export, tray icon, and single-sticker share links all use the **same**
painter. Pack validation (`validatePack`) and the portable manifest
(`packManifest`) live in `src/lib/whatsapp.ts` — deliberately shaped so a
future Android ContentProvider wrapper can consume `pack.json` unchanged.

### Sticker pack schema (frozen v1 — the bridge contract)

`pack.json` (`format: "lovekit-sticker-pack"`, `version: 1`) is the stable
contract between the web exporter and any future native wrapper:

```json
{
  "format": "lovekit-sticker-pack",
  "version": 1,
  "android": { "identifier": "lovekit.<packid>", "publisher": "Author", "trayImageFile": "tray_icon.png" },
  "name": "Us ❤️",
  "author": "Dev",
  "description": "…",
  "stickers": [{ "file": "sticker_01.png", "emoji": ["❤️"], "name": "Miss You" }],
  "whatsappSpecs": { "stickerPx": 512, "stickerMaxKb": 100, "trayPx": 96, "trayMaxKb": 50 }
}
```

Rules enforced by `validatePackManifest()` (run it on *import*, not just export):
3–30 stickers · files named `sticker_NN.png|webp` (no paths, no traversal) ·
each with ≥1 emoji · 512×512 transparent · each <100 KB · tray 96×96 <50 KB.
A full export folder is: `pack.json` + `tray_icon.png` + `sticker_01.png…`.

### Android bridge readiness (wrapper NOT built yet)

The web side is done; a future native app only needs to: (1) accept the
export folder (file picker, USB, or later a share intent), (2) run the same
`validatePackManifest` rules, (3) register the pack with WhatsApp through the
**official native mechanism** — a sticker ContentProvider as documented in
WhatsApp's official sample sticker app (the `WhatsApp/stickers` reference
project). There is deliberately no web “one-tap Add to WhatsApp”: browsers
expose no such API, and we won't pretend otherwise. The current in-app guide
(import via a reputable sticker-maker app) remains the honest path until the
wrapper exists.

## 🔐 Privacy philosophy

- No servers, no accounts, no analytics, no third-party scripts.
- Photos are resized **on-device** and never uploaded.
- Share links embed the gift in the URL — send them like sealed letters.
- Capsules are ciphertext until the date; with a passphrase they’re genuinely
  unreadable otherwise (AES-GCM, 120k-round PBKDF2).
- The writing helper works fully offline; a custom AI endpoint only ever
  receives text you approve — never photos. No keys in the codebase, ever.
- Full details in-app: **Privacy** page in the footer.

## 📲 Android Sticker Bridge (V1.2)

The web app can't push stickers into WhatsApp (no browser API exists) — so
`android/` is a tiny native bridge (Kotlin, zero runtime permissions, no
network, no accounts) that:

1. **Imports** a web export folder (`pack.json` + `tray_icon.png` +
   `sticker_01.png …`) via file picker or `.zip`, treating everything as
   untrusted (strict JSON parser, filename whitelist, magic-byte sniffing,
   dimension/size/duplicate checks, zip-bomb caps).
2. **Previews** the pack with a validation checklist.
3. **Registers** it with WhatsApp through the **official** mechanism
   (exported `ContentProvider` + `com.whatsapp.intent.action.ENABLE_STICKER_PACK`
   + whitelist re-check) — verified against WhatsApp's official
   `WhatsApp/stickers` sample. PNGs are converted to WhatsApp-ready WebP
   on-device at import.
4. Reports success **only** from WhatsApp's own result — never faked; exact
   reasons when WhatsApp is missing or unresponsive.

Build: `cd android && ./gradlew :app:assembleDebug` (JDK 17+, SDK 35).
Full contract, schema, security model and honest limitations:
[`android/README.md`](android/README.md).

## 🗺️ Roadmap

1. ~~**PWA + offline install**~~ — **shipped in V1.1** (manifest, service
   worker, install card, GET share-target intake).
2. ~~**Android wrapper**~~ — **shipped in V1.2** (`android/`: import, validate,
   preview, official WhatsApp add-flow; verified on emulator up to the
   WhatsApp-app boundary).
3. **More games & locales** — community packs under `/games`, `/locales`,
   `/message-packs` (see CONTRIBUTING).

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New games, themes, templates and
translations are the most-wanted contributions — each takes one file.

## 📄 License

MIT — see [LICENSE](LICENSE). Made with ♥ for real couples.
