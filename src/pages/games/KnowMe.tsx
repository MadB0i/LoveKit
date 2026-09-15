import { useMemo, useState } from 'react';
import ShareBox from '../../components/ShareBox';
import { KNOW_ME_QUESTIONS, knowMeVerdict, scoreKnowMe } from '../../games/knowMe';
import { cleanName, cleanText } from '../../lib/sanitize';

type Phase = 'setup' | 'self1' | 'handoff1' | 'guess1' | 'self2' | 'handoff2' | 'guess2' | 'reveal';

export default function KnowMe(): React.ReactElement {
  const [names, setNames] = useState({ p1: '', p2: '' });
  const [picked, setPicked] = useState<string[]>(KNOW_ME_QUESTIONS.slice(0, 5).map((q) => q.id));
  const [phase, setPhase] = useState<Phase>('setup');
  const [self1, setSelf1] = useState<Record<string, string>>({});
  const [guess1, setGuess1] = useState<Record<string, string>>({});
  const [self2, setSelf2] = useState<Record<string, string>>({});
  const [guess2, setGuess2] = useState<Record<string, string>>({});

  const questions = useMemo(() => picked.map((id) => KNOW_ME_QUESTIONS.find((q) => q.id === id)!).filter(Boolean), [picked]);
  const p1 = cleanName(names.p1) || 'Player 1';
  const p2 = cleanName(names.p2) || 'Player 2';

  const togglePick = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 6 ? prev : [...prev, id]));

  const allAnswered = (obj: Record<string, string>) => questions.every((q) => cleanText(obj[q.id] ?? '', 300));

  const round1 = scoreKnowMe(self1, guess1, picked);
  const round2 = scoreKnowMe(self2, guess2, picked);

  const reset = () => {
    setPhase('setup');
    setSelf1({});
    setGuess1({});
    setSelf2({});
    setGuess2({});
  };

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>🧠 How Well Do You Know Me?</h1>
        <p>Answer separately. Reveal together. Defend your score.</p>
      </div>

      {phase === 'setup' && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>1 · Who’s playing? (nicknames are fine)</h3>
          <div className="share-box">
            <input className="input" placeholder="Player 1" value={names.p1} maxLength={30} onChange={(e) => setNames({ ...names, p1: e.target.value })} aria-label="Player 1 name" />
            <input className="input" placeholder="Player 2" value={names.p2} maxLength={30} onChange={(e) => setNames({ ...names, p2: e.target.value })} aria-label="Player 2 name" />
          </div>
          <h3>2 · Pick 5 questions (up to 6)</h3>
          <div className="chips">
            {KNOW_ME_QUESTIONS.map((q) => (
              <button key={q.id} className="chip" aria-pressed={picked.includes(q.id)} title={q.example} onClick={() => togglePick(q.id)}>
                {picked.includes(q.id) ? '✓ ' : ''}{q.prompt}
              </button>
            ))}
          </div>
          {picked.length < 3 && <p className="notice warn">Pick at least 3 questions to make it interesting.</p>}
          <button className="btn btn-primary" disabled={picked.length < 3} onClick={() => setPhase('self1')}>
            Start — {p1} answers first →
          </button>
        </div>
      )}

      {(phase === 'self1' || phase === 'self2') && (
        <AnswerForm
          title={phase === 'self1' ? `${p1}, answer about YOURSELF` : `${p2}, now you — about YOURSELF`}
          subtitle={`${phase === 'self1' ? p2 : p1}, look away! 🙈`}
          questions={questions}
          values={phase === 'self1' ? self1 : self2}
          setValues={phase === 'self1' ? setSelf1 : setSelf2}
          cta="Lock my answers →"
          canGo={allAnswered(phase === 'self1' ? self1 : self2)}
          onGo={() => setPhase(phase === 'self1' ? 'handoff1' : 'handoff2')}
        />
      )}

      {(phase === 'handoff1' || phase === 'handoff2') && (
        <div className="panel" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '3rem' }}>📱➡️💕</div>
          <h2>Pass the phone {phase === 'handoff1' ? `to ${p2}` : `to ${p1}`}!</h2>
          <p>
            {phase === 'handoff1'
              ? `Guess how ${p1} answered. No peeking at previous screens!`
              : `Guess how ${p2} answered. Honour system. ❤️`}
          </p>
          <button className="btn btn-primary" onClick={() => setPhase(phase === 'handoff1' ? 'guess1' : 'guess2')}>
            I’m {phase === 'handoff1' ? p2 : p1} — let’s go →
          </button>
        </div>
      )}

      {(phase === 'guess1' || phase === 'guess2') && (
        <AnswerForm
          title={phase === 'guess1' ? `${p2}, guess ${p1}’s answers` : `${p1}, guess ${p2}’s answers`}
          subtitle="Channel them. What would THEY write?"
          questions={questions}
          values={phase === 'guess1' ? guess1 : guess2}
          setValues={phase === 'guess1' ? setGuess1 : setGuess2}
          cta="Lock my guesses →"
          canGo={allAnswered(phase === 'guess1' ? guess1 : guess2)}
          onGo={() => setPhase(phase === 'guess1' ? 'self2' : 'reveal')}
        />
      )}

      {phase === 'reveal' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <RevealBlock
            title={`${p2} knows ${p1}`}
            score={round1}
            questions={questions}
            selfAnswers={self1}
            guesses={guess1}
            guesser={p2}
          />
          <RevealBlock
            title={`${p1} knows ${p2}`}
            score={round2}
            questions={questions}
            selfAnswers={self2}
            guesses={guess2}
            guesser={p1}
          />
          <div className="panel" style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.3rem' }}>
              {round1.matches + round2.matches} / {round1.total + round2.total} total
            </h2>
            <p>{knowMeVerdict(round1.matches + round2.matches, round1.total + round2.total)}</p>
            <div className="share-box" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={reset}>
                ↻ Play again
              </button>
            </div>
            <div style={{ marginTop: '0.8rem' }}>
              <ShareBox
                kind="game"
                label="game challenge"
                buildPayload={() => ({
                  game: 'know-me',
                  from: p1,
                  questionIds: JSON.stringify(picked),
                  self: JSON.stringify(self1),
                })}
              />
            </div>
            <p className="hint">Challenge link: {p1}’s answers travel secretly — your partner guesses them.</p>
          </div>
        </div>
      )}
    </>
  );
}

function AnswerForm({
  title,
  subtitle,
  questions,
  values,
  setValues,
  cta,
  canGo,
  onGo,
}: {
  title: string;
  subtitle: string;
  questions: { id: string; prompt: string; example: string }[];
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
  cta: string;
  canGo: boolean;
  onGo: () => void;
}): React.ReactElement {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: 'var(--ink-soft)' }}>{subtitle}</p>
      {questions.map((q, i) => (
        <div className="field" key={q.id}>
          <label htmlFor={`q-${q.id}`}>
            {i + 1}. {q.prompt}
          </label>
          <input
            id={`q-${q.id}`}
            className="input"
            placeholder={`e.g. ${q.example}`}
            value={values[q.id] ?? ''}
            maxLength={300}
            onChange={(e) => setValues({ ...values, [q.id]: e.target.value })}
          />
        </div>
      ))}
      {!canGo && <p className="notice warn">Answer every question — gut answers count double. (Not really. But answer them.)</p>}
      <button className="btn btn-primary" disabled={!canGo} onClick={onGo}>
        {cta}
      </button>
    </div>
  );
}

function RevealBlock({
  title,
  score,
  questions,
  selfAnswers,
  guesses,
  guesser,
}: {
  title: string;
  score: { matches: number; total: number; perQuestion: { id: string; match: boolean }[] };
  questions: { id: string; prompt: string }[];
  selfAnswers: Record<string, string>;
  guesses: Record<string, string>;
  guesser: string;
}): React.ReactElement {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>
        {title}: {score.matches}/{score.total} {score.matches === score.total ? '🏆' : score.matches >= Math.ceil(score.total / 2) ? '💛' : '🫶'}
      </h2>
      <div style={{ display: 'grid', gap: '0.6rem' }} role="list" aria-label="Answer comparison">
        {questions.map((q) => {
          const match = score.perQuestion.find((p) => p.id === q.id)?.match;
          return (
            <div key={q.id} className={`quiz-opt ${match ? 'correct' : 'wrong'}`} style={{ cursor: 'default' }} role="listitem">
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{q.prompt}</div>
              <div>
                {match ? '✅' : '❌'} Truth: <strong>{selfAnswers[q.id]}</strong>
                {!match && (
                  <>
                    {' '}· {guesser} guessed: <strong>{guesses[q.id]}</strong>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
