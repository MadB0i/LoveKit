import { useState } from 'react';
import ShareBox from '../../components/ShareBox';
import { WHO_SAID_IDEAS, createStatement, scoreWhoSaidIt, whoSaidVerdict, type Person, type WhoStatement } from '../../games/whoSaidIt';
import { cleanName } from '../../lib/sanitize';

export default function WhoSaidIt(): React.ReactElement {
  const [writer, setWriter] = useState('');
  const [guesser, setGuesser] = useState('');
  const [statements, setStatements] = useState<WhoStatement[]>([]);
  const [draft, setDraft] = useState('');
  const [draftAuthor, setDraftAuthor] = useState<Person>('me');
  const [phase, setPhase] = useState<'write' | 'handoff' | 'guess' | 'reveal'>('write');
  const [guesses, setGuesses] = useState<Record<string, Person>>({});
  const [guessIndex, setGuessIndex] = useState(0);

  const w = cleanName(writer) || 'The Writer';
  const g = cleanName(guesser) || 'The Guesser';
  const result = scoreWhoSaidIt(statements, guesses);

  const addDraft = () => {
    const s = createStatement(draft, draftAuthor);
    if (!s) return;
    setStatements((prev) => [...prev, s]);
    setDraft('');
  };

  const current = statements[guessIndex];

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>🫣 Who Said It?</h1>
        <p>One writes the lore. The other takes the blame. ME or YOU?</p>
      </div>

      {phase === 'write' && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Who’s who? (nicknames welcome)</h3>
          <div className="share-box" style={{ marginBottom: '1rem' }}>
            <input className="input" placeholder="Writer" aria-label="Writer name" value={writer} maxLength={30} onChange={(e) => setWriter(e.target.value)} />
            <input className="input" placeholder="Guesser" aria-label="Guesser name" value={guesser} maxLength={30} onChange={(e) => setGuesser(e.target.value)} />
          </div>
          <h3>
            {w}, write {Math.max(0, 5 - statements.length) > 0 ? `at least ${5 - statements.length} more` : 'as many as you like'} statements ({statements.length} so far)
          </h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
            Little truths, habits, hot takes. Mark who each one is really about — {g} must look away! 🙈
          </p>
          <div className="share-box">
            <input
              className="input"
              placeholder="e.g. Falls asleep during movies"
              value={draft}
              maxLength={140}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDraft()}
              aria-label="New statement"
              style={{ flex: 2 }}
            />
            <button className={`btn btn-sm ${draftAuthor === 'me' ? 'btn-ink' : 'btn-ghost'}`} aria-pressed={draftAuthor === 'me'} onClick={() => setDraftAuthor('me')}>
              ME
            </button>
            <button className={`btn btn-sm ${draftAuthor === 'you' ? 'btn-ink' : 'btn-ghost'}`} aria-pressed={draftAuthor === 'you'} onClick={() => setDraftAuthor('you')}>
              YOU
            </button>
            <button className="btn btn-sm btn-primary" onClick={addDraft} disabled={!draft.trim()}>
              Add
            </button>
          </div>
          <div className="field" style={{ marginTop: '0.8rem' }}>
            <label>Need inspiration? <span className="hint">tap to pre-fill</span></label>
            <div className="chips">
              {WHO_SAID_IDEAS.map((idea) => (
                <button key={idea} className="chip" onClick={() => setDraft(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', margin: '1rem 0' }}>
            {statements.map((s) => (
              <div className="el-row" key={s.id}>
                <span className="grow">“{s.text}” → <strong>{s.author === 'me' ? w : g}</strong> (secret!)</span>
                <button className="btn btn-sm btn-danger" onClick={() => setStatements((prev) => prev.filter((x) => x.id !== s.id))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          {statements.length < 3 && <p className="notice warn">Add at least 3 statements (5 is the sweet spot).</p>}
          <button className="btn btn-primary" disabled={statements.length < 3} onClick={() => setPhase('handoff')}>
            Done — pass to {g} →
          </button>
        </div>
      )}

      {phase === 'handoff' && (
        <div className="panel" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '3rem' }}>📱➡️🫣</div>
          <h2>Pass the phone to {g}!</h2>
          <p>{statements.length} statements. For each: is it about YOU ({g}) or {w}? Trust your gut.</p>
          <button className="btn btn-primary" onClick={() => { setPhase('guess'); setGuessIndex(0); }}>
            I’m {g} — quiz me →
          </button>
        </div>
      )}

      {phase === 'guess' && current && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p className="hint">
            {guessIndex + 1} of {statements.length}
          </p>
          <h2 style={{ fontSize: '1.6rem' }}>“{current.text}”</h2>
          <p>Who is this about, {g}?</p>
          {/* NOTE: votes are stored in the writer's frame of reference —
              "me" = the writer, "you" = the guesser — so the buttons map
              accordingly. */}
          <div className="share-box" style={{ justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                const next = { ...guesses, [current.id]: 'you' as Person };
                setGuesses(next);
                if (guessIndex + 1 >= statements.length) setPhase('reveal');
                else setGuessIndex(guessIndex + 1);
              }}
            >
              🙋 ME ({g})
            </button>
            <button
              className="btn btn-ink"
              onClick={() => {
                const next = { ...guesses, [current.id]: 'me' as Person };
                setGuesses(next);
                if (guessIndex + 1 >= statements.length) setPhase('reveal');
                else setGuessIndex(guessIndex + 1);
              }}
            >
              👉 YOU ({w})
            </button>
          </div>
        </div>
      )}

      {phase === 'reveal' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="panel" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.2rem' }}>
              {result.correct}/{result.total} correct {result.correct === result.total ? '🏆' : '🫣'}
            </h2>
            <p>{whoSaidVerdict(result.correct, result.total)}</p>
          </div>
          <div className="panel">
            {statements.map((s) => {
              const ok = guesses[s.id] === s.author;
              return (
                <div key={s.id} className={`quiz-opt ${ok ? 'correct' : 'wrong'}`} style={{ cursor: 'default' }}>
                  {ok ? '✅' : '❌'} “{s.text}” — it was <strong>{s.author === 'me' ? w : g}</strong>
                  {!ok && <>, {g} said {guesses[s.id] === 'me' ? w : g}</>}
                </div>
              );
            })}
            <div className="share-box" style={{ marginTop: '0.8rem' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPhase('write');
                  setStatements([]);
                  setGuesses({});
                  setGuessIndex(0);
                }}
              >
                ↻ New round (swap roles!)
              </button>
            </div>
            <div style={{ marginTop: '0.8rem' }}>
              <ShareBox
                kind="game"
                label="game challenge"
                buildPayload={() => ({
                  game: 'who-said-it',
                  from: w,
                  statements: JSON.stringify(statements.map((s) => ({ text: s.text, author: s.author }))),
                })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
