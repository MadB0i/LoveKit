import { Link } from 'react-router-dom';
import { GAMES } from '../games/registry';

export default function Games(): React.ReactElement {
  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>🎮 Couple games</h1>
        <p>Real games, not quizzes that flatter you. One phone, two players, pass-and-play.</p>
      </div>
      <div className="grid cols-3">
        {GAMES.map((g) => (
          <Link key={g.id} to={g.route} className="feature-card">
            <span className="f-emoji" aria-hidden="true">
              {g.emoji}
            </span>
            <h3>{g.title}</h3>
            <p>
              <em>{g.tagline}</em>
            </p>
            <p>{g.description}</p>
            <p className="hint" style={{ fontSize: '0.8rem' }}>
              {g.players} · {g.duration}
            </p>
            <span className="go">Play →</span>
          </Link>
        ))}
      </div>
      <div className="panel" style={{ marginTop: '1.2rem' }}>
        <h3 style={{ marginTop: 0 }}>How pass-and-play works 📱</h3>
        <p style={{ marginBottom: 0 }}>
          One of you answers while the other looks away (dramatic phone-handoff included), then you swap. No accounts,
          no waiting for invites — though every game can also send a <strong>challenge link</strong> so your partner
          can play their half later.
        </p>
      </div>
    </>
  );
}
