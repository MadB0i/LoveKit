import { Link } from 'react-router-dom';
import { Confetti } from '../components/Effects';

const FEATURES = [
  { to: '/cards', emoji: '💌', title: 'Love cards', body: 'A beautiful editor with heartfelt starters, themes and animations. Download, share, swoon.' },
  { to: '/stickers', emoji: '😍', title: 'WhatsApp Sticker Maker', body: 'Cut, caption and decorate 512×512 stickers. Export spec-valid packs with honest import guides.' },
  { to: '/games', emoji: '🎮', title: 'Couple games', body: 'Three genuinely playable games: Know Me, Who Said It, and This-or-That. Pass-and-play.' },
  { to: '/memories', emoji: '📸', title: 'Memories', body: 'A private timeline of firsts, trips and tiny Tuesdays. Yours alone — never public by default.' },
  { to: '/coupons', emoji: '🎟️', title: 'Love coupons', body: '“One free hug”, “You pick dinner” — design them, share them, redeem them.' },
  { to: '/capsules', emoji: '⏳', title: 'Time capsules', body: 'Write to your future selves. Sealed with real encryption, opened on the day.' },
];

export default function Home(): React.ReactElement {
  return (
    <>
      <section className="hero">
        <Confetti count={22} />
        <span className="eyebrow">Open-source · private by design</span>
        <h1>
          Build moments, <em>not algorithms.</em>
        </h1>
        <p className="lede">
          LoveKit is a toolkit for <strong>real couples</strong> — cards, stickers, games, memories, coupons and
          time capsules. No AI partner, no compatibility scores, no accounts. Just help expressing what you already
          feel.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" to="/cards">
            💌 Make a love card
          </Link>
          <Link className="btn btn-ghost" to="/stickers">
            😍 Make a sticker
          </Link>
          <Link className="btn btn-ghost" to="/games">
            🎮 Play a game
          </Link>
        </div>
      </section>

      <section className="section" aria-label="Features">
        <div className="grid cols-3">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className="feature-card">
              <span className="f-emoji" aria-hidden="true">
                {f.emoji}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <span className="go">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How it works</h2>
          <p>Local-first, gift-wrapped sharing</p>
        </div>
        <ol className="steps">
          <li>
            <span>
              <strong>Create on your phone.</strong> Cards, stickers, games, memories — everything is made and stored
              in your browser. Nothing uploads anywhere.
            </span>
          </li>
          <li>
            <span>
              <strong>Share a surprise link.</strong> Your creation is packed into a link like{' '}
              <code>…#/l/ABC123</code>. Your partner opens a gift-wrapped reveal — no account, no app install.
            </span>
          </li>
          <li>
            <span>
              <strong>Keep the originals.</strong> Saved items live on your device. Export PNGs and pack files any
              time for WhatsApp, printing, or framing.
            </span>
          </li>
        </ol>
      </section>

      <section className="section">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Our philosophy 🤍</h3>
          <p style={{ marginBottom: 0 }}>
            AI should help humans love each other better — <strong>not replace human love</strong>. LoveKit will never
            pretend to be your partner, never score your compatibility, and never tell you whether someone is “true
            love”. It just helps you remember, appreciate, apologise, play and celebrate — the unglamorous verbs real
            relationships are made of.
          </p>
        </div>
      </section>
    </>
  );
}
