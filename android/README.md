# LoveKit Sticker Bridge (Android) 📲❤️

A **tiny native wrapper** that carries a LoveKit Web sticker-pack export into
WhatsApp through WhatsApp's officially supported third-party sticker
mechanism. The web app stays the creation studio; this app only
**imports → validates → previews → registers**.

- No accounts, no network, no analytics, no tracking.
- No `INTERNET` permission. No storage permissions (Storage Access Framework).
- Kotlin, AndroidX only (`core-ktx`, `appcompat`, `documentfile`), JUnit4 tests.

## How a pack flows into WhatsApp

1. **LoveKit Web → Sticker Maker → pack panel:** download `pack.json`,
   `tray_icon.png`, `sticker_01.png …` into **one folder** (exact names —
   they already match `pack.json`, no renames needed).
2. **Bridge → Import pack folder** (or a `.zip` of it).
3. Bridge validates everything and shows a checklist:
   `✓ manifest · ✓ 512×512 · ✓ WebP · ✓ tray 96×96 · ✓ count`.
   PNG stickers are converted to WhatsApp-ready WebP on-device.
4. **Add to WhatsApp** → WhatsApp's own confirm dialog → pack lands in the
   sticker picker. Success is reported only from WhatsApp's result +
   whitelist re-check — never assumed.

## The official mechanism (verified)

This implements the contract from WhatsApp's official `WhatsApp/stickers`
sample app + Android README (still current):

- Exported `ContentProvider` (`…stickerprovider`, authority starts with our
  package, `readPermission="com.whatsapp.sticker.READ"`).
- Four endpoints with WhatsApp's exact strings: `metadata`,
  `metadata/<id>`, `stickers/<id>`, `stickers_asset/<id>/<file>`.
- Enable intent: action `com.whatsapp.intent.action.ENABLE_STICKER_PACK`
  with `sticker_pack_id` / `sticker_pack_authority` / `sticker_pack_name`.
- Whitelist checks against `com.whatsapp.provider.sticker_whitelist_check`
  (consumer) and `com.whatsapp.w4b.provider.sticker_whitelist_check`
  (Business); `result` 1 = added, 0 = not, null = unknown/too old.
- Specs enforced at import: 512×512 WebP ≤100 KB each, tray 96×96 PNG ≤50 KB,
  3–30 static stickers per pack, ≤10 packs per app, all-static (animated
  WebP inputs are rejected with a clear message).

## The `pack.json` contract (frozen schema v1)

Produced by LoveKit Web (`src/lib/whatsapp.ts → packManifest()`), validated
here by `ManifestParser` + `PackValidator` (mirrors web
`validatePackManifest()`):

```json
{
  "format": "lovekit-sticker-pack", "version": 1,
  "android": { "identifier": "lovekit.usdev", "publisher": "Dev", "trayImageFile": "tray_icon.png" },
  "name": "Us ❤️", "author": "Dev", "description": "…",
  "stickers": [{ "file": "sticker_01.png", "emoji": ["❤️"], "name": "Miss You" }],
  "whatsappSpecs": { "stickerPx": 512, "stickerMaxKb": 100, "trayPx": 96, "trayMaxKb": 50 }
}
```

`android.identifier` becomes the WhatsApp pack identifier (authority +
identifier is the pair WhatsApp remembers). If absent, the bridge derives
`lovekit.<slug(name)><slug(author)>` — V1 web exports always include it.

## Security model (imports are hostile input)

- Strict dependency-free JSON parser (`MiniJson`): depth + size caps, no
  trailing garbage, no NaN/Infinity.
- File names: canonical `sticker_NN.(png|webp)` / `tray_icon.png` /
  `pack.json` only; any `/`, `\`, `..`, dotfile or absolute name rejects the
  whole import. Served files are whitelisted against the stored index +
  canonical-path checked.
- Magic bytes sniffed (PNG/RIFF-WEBP) — extensions never trusted.
- Per-file (2 MB) + total (12 MB) copy caps → zip-bombs die early.
- Byte-duplicate stickers rejected (distinct sha256 required).
- Provider serves internal-storage files read-only; `insert/delete/update`
  throw.

## Build

Requirements: JDK 17+, Android SDK (platform 35, build-tools 35+) with
`ANDROID_HOME` set (or `local.properties` with `sdk.dir=` — machine-local,
never committed).

```bash
cd android
./gradlew :app:testDebugUnitTest   # unit tests (pure JVM)
./gradlew :app:lintDebug           # Android lint
./gradlew :app:assembleDebug       # APK → app/build/outputs/apk/debug/
```

`minSdk 26` · `targetSdk/compileSdk 35` · zero runtime permissions.

## Limitations (honest)

- End-to-end WhatsApp confirmation needs WhatsApp installed with a verified
  number — CI/emulator runs verify import + preview + validation only.
- One pack at a time, per WhatsApp's explicit add flow (no "add all").
- Static stickers only in V1 (animated inputs rejected, not silently flattened).
- iOS is out of scope (Apple requires fuller apps; see WhatsApp's own notice).
