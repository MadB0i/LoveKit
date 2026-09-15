# LoveKit ❤️

**The open-source toolkit for meaningful relationships.**
*Build moments, not algorithms.*

LoveKit helps **two real people** — not an AI partner — make cards, stickers,
games, memories, coupons and time capsules for each other. No accounts, no
servers, no tracking. Everything stays on your device.

## ✨ What it does

- 💌 **Love cards** — occasions, themes, animations, PNG export, share links
- 😍 **WhatsApp Sticker Maker** — 512px stickers, packs, honest import guide
- 🎮 **Couple games** — Know Me, Who Said It, This-or-That (+ challenges)
- 📸 **Memories** · 🎟️ **Coupons** · ⏳ **Time capsules** (AES-GCM sealed)
- 🔗 **Surprise links** (`#/l/…`) — no account needed to open
- 📲 **PWA** — installable, works offline · 🤖 **Android bridge** (`android/`)
- 🔜 **E2EE chat** — protocol frozen (`docs/e2ee-protocol.md`), Supabase pairing next

## 🚀 Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static dist/ → host anywhere
npm test           # 49+ tests
```

Android bridge: `cd android && ./gradlew :app:assembleDebug` (details in
[`android/README.md`](android/README.md)).

## 🔐 Privacy in one paragraph

No backend means nothing to leak: photos never upload, share links carry the
gift inside the URL (send like a sealed letter), and passphrase capsules are
genuinely unreadable without the words. Full model in-app (footer → Privacy).

## ⚠️ One honest limitation

Browsers can't push stickers into WhatsApp — no web API exists. LoveKit
exports spec-valid assets + `pack.json`, and the Android bridge performs
WhatsApp's **official** add flow. Anyone promising one-tap web import is
selling something.

## 🤝 Contributing

New games, themes and templates each take one file — see
[CONTRIBUTING.md](CONTRIBUTING.md). Be kind, keep it tasteful.

## 📄 License

MIT — see [LICENSE](LICENSE). Made with ♥ for real couples.
