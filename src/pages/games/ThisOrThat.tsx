import { useState } from 'react';
import ShareBox from '../../components/ShareBox';
import { THIS_OR_THAT_PAIRS, overlapLabel, recordPick, scoreThisOrThat } from '../../games/thisOrThat';
import { cleanName } from '../../lib/sanitize';

export default function ThisOrThat(): React.ReactElement {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [phase, setPhase] = useState<'names' | 'picksA' | 'handoff' | 'picksB' | 'reveal'>('names');
  const [picksA, setPicksA] = useState<Record<string, string>>({});
  const [picksB, setPicksB] = useState<Record<string, string>>({});

  const nameA = cleanName(p1) || 'Player 1';
  const nameB = cleanName(p2) || 'Player 2';
  const ids = THIS_OR_THAT_PAIRS.map((p) => p.id);
  const score = scoreThisOrThat(picksA, picksB, ids);

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>⚖️ This or That</h1>
        <p>Twelve dilemmas. No overthinking. Matches are date ideas in disguise.</p>
      </div>

      {phase === 'names' && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Who’s playing?</h3>
          <div className="share-box">
            <input className="input" placeholder="Player 1" aria-label="Player 1 name" value={p1} maxLength={30} onChange={(e) => setP1(e.target.value)} />
            <input className="input" placeholder="Player 2" aria-label="Player 2 name" value={p2} maxLength={30} onChange={(e) => setP2(e.target.value)} />
          </div>
          <p className="hint">Just so the scoreboard knows who to tease.</p>
          <button className="btn btn-primary" onClick={() => setPhase('picksA')}>
            Start — {nameA} picks first →
          </button>
        </div>
      )}

      {(phase === 'picksA' || phase === 'picksB') && (
        <PickBoard
          title={phase === 'picksA' ? `${nameA}, pick fast! ⚡` : `${nameB}, your turn — no peeking! 🙈`}
          picks={phase === 'picksA' ? picksA : picksB}
          onPick={(id, side) =>
            phase === 'picksA'
              ? setPicksA((prev) => recordPick(prev, id, side))
              : setPicksB((prev) => recordPick(prev, id, side))
          }
          done={Object.keys(phase === 'picksA' ? picksA : picksB).length >= ids.length}
          cta={phase === 'picksA' ? `Lock it in — pass to ${nameB} →` : 'Reveal our overlap →'}
          onDone={() => setPhase(phase === 'picksA' ? 'handoff' : 'reveal')}
        />
      )}

      {phase === 'handoff' && (
        <div className="panel" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '3rem' }}>📱➡️⚖️</div>
          <h2>Pass the phone to {nameB}!</h2>
          <p>{nameA} has chosen. {nameB}, trust your gut — first instinct wins.</p>
          <button className="btn btn-primary" onClick={() => setPhase('picksB')}>
            I’m {nameB} — let’s go →
          </button>
        </div>
      )}

      {phase === 'reveal' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="panel" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.2rem' }}>
              {score.matches}/{score.total} in sync {score.matches >= 9 ? '💛' : score.matches >= 6 ? '✨' : '🫶'}
            </h2>
            <p>{overlapLabel(score.matches, score.total)}</p>
            <p className="hint">Reminder: this measures taste overlap, not love. Love is the part where you do their pick anyway. ❤️</p>
          </div>
          <div className="panel">
            <div role="list" aria-label="Taste comparison">
            {THIS_OR_THAT_PAIRS.map((pair) => {
              const match = picksA[pair.id] === picksB[pair.id];
              return (
                <div key={pair.id} className={`quiz-opt ${match ? 'correct' : 'wrong'}`} style={{ cursor: 'default' }} role="listitem">
                  {match ? '💛' : '😄'} {nameA}: <strong>{picksA[pair.id]}</strong> · {nameB}:{' '}
                  <strong>{picksB[pair.id]}</strong>
                  {match && <> — date idea unlocked!</>}
                </div>
              );
            })}
            </div>
            <div className="share-box" style={{ marginTop: '0.8rem' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPicksA({});
                  setPicksB({});
                  setPhase('picksA');
                }}
              >
                ↻ Play again
              </button>
            </div>
            <div style={{ marginTop: '0.8rem' }}>
              <ShareBox
                kind="game"
                label="game challenge"
                buildPayload={() => ({
                  game: 'this-or-that',
                  from: nameA,
                  pairIds: JSON.stringify(ids),
                  picks: JSON.stringify(picksA),
                })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PickBoard({
  title,
  picks,
  onPick,
  done,
  cta,
  onDone,
}: {
  title: string;
  picks: Record<string, string>;
  onPick: (id: string, side: string) => void;
  done: boolean;
  cta: string;
  onDone: () => void;
}): React.ReactElement {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: 'var(--ink-soft)' }}>
        {Object.keys(picks).length}/{THIS_OR_THAT_PAIRS.length} answered
      </p>
      {THIS_OR_THAT_PAIRS.map((pair) => (
        <div key={pair.id} style={{ marginBottom: '0.9rem' }}>
          <div className="share-box">
            {([pair.a, pair.b] as const).map((side) => (
              <button
                key={side}
                className="quiz-opt"
                style={{ flex: 1, marginBottom: 0 }}
                aria-pressed={picks[pair.id] === side}
                onClick={() => onPick(pair.id, side)}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!done && <p className="notice warn">Answer all {THIS_OR_THAT_PAIRS.length} — speed round rules! ⚡</p>}
      <button className="btn btn-primary" disabled={!done} onClick={onDone}>
        {cta}
      </button>
    </div>
  );
}
