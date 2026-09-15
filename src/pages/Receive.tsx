import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import { KNOW_ME_QUESTIONS, scoreKnowMe } from '../games/knowMe';
import { THIS_OR_THAT_PAIRS, overlapLabel, scoreThisOrThat } from '../games/thisOrThat';
import { scoreWhoSaidIt, type Person } from '../games/whoSaidIt';
import { importSharedKey, isUnlocked, lockRemaining, unsealCapsule } from '../lib/capsules';
import { startLullaby, stopLullaby } from '../lib/music';
import { cleanText } from '../lib/sanitize';
import { asSafeList, asSafeRecord, decodeShare } from '../lib/share';
import { KEYS, load, save, uid } from '../lib/store';
import type { CardAnimation, CardEffect, LoveCard } from '../lib/types';

function parseJsonArray(s: string): string[] {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => cleanText(String(x ?? ''), 500)).filter(Boolean) : [];
  } catch {
    return [];
  }
}
function parseJsonRecord(s: string): Record<string, string> {
  try {
    const v: unknown = JSON.parse(s);
    if (typeof v !== 'object' || v === null) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = cleanText(String(val ?? ''), 500);
    return out;
  } catch {
    return {};
  }
}

export default function Receive(): React.ReactElement {
  const { code } = useParams();
  const [unwrapped, setUnwrapped] = useState(false);
  const [musicOn, setMusicOn] = useState(false);

  useEffect(() => () => stopLullaby(), []);

  const decoded = useMemo(() => decodeShare(code ?? ''), [code]);
  const data = useMemo(() => (decoded.ok ? asSafeRecord(decoded.data) : {}), [decoded, code]);

  // Stash a shared capsule key on arrival (the date lock is still enforced).
  useEffect(() => {
    if (decoded.ok && decoded.kind === 'capsule' && data.id && data.key) {
      importSharedKey(data.id, data.key);
    }
  }, [decoded, data, code]);

  if (!decoded.ok) {
    return (
      <div className="empty" style={{ paddingTop: '4rem' }}>
        <span className="big">💔</span>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>This surprise couldn’t be opened</h1>
        <p>{decoded.error}</p>
        <p>
          <Link className="btn btn-primary" to="/">
            Make your own surprise ❤️
          </Link>
        </p>
      </div>
    );
  }

  if (!unwrapped) {
    return (
      <div className="receive-hero">
        <span className="seal-big" aria-hidden="true">
          💝
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>You received something from someone who loves you ❤️</h1>
        <p className="lede">It’s wrapped, it’s safe, and it was made just for you. Ready?</p>
        <button className="btn btn-primary" onClick={() => setUnwrapped(true)} style={{ fontSize: '1.05rem' }}>
          🎁 Unwrap it
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
      {decoded.kind === 'card' && (
        <ReceivedCard
          data={data}
          musicOn={musicOn}
          setMusicOn={setMusicOn}
        />
      )}
      {decoded.kind === 'coupon' && <ReceivedCoupon data={data} />}
      {decoded.kind === 'memory' && <ReceivedMemory data={data} />}
      {decoded.kind === 'capsule' && <ReceivedCapsule data={data} />}
      {decoded.kind === 'game' && <ReceivedGame data={data} />}
      {decoded.kind === 'sticker' && <ReceivedSticker data={data} />}
      {decoded.kind === 'pack' && <ReceivedPack data={data} />}
      <p style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link className="btn btn-ghost" to="/">
          Make one back ❤️
        </Link>
      </p>
    </div>
  );
}

/* ---------------- card ---------------- */

function ReceivedCard({
  data,
  musicOn,
  setMusicOn,
}: {
  data: Record<string, string>;
  musicOn: boolean;
  setMusicOn: (v: boolean) => void;
}): React.ReactElement {
  const card: LoveCard = {
    id: uid('card'),
    category: (data.category as LoveCard['category']) || 'just-because',
    toName: data.toName || 'My Love',
    fromName: data.fromName || '',
    message: data.message || '',
    themeId: data.themeId || 'ember',
    effects: (data.effects || 'hearts').split(',').filter(Boolean) as CardEffect[],
    animation: (data.animation as CardAnimation) || 'reveal',
    emoji: data.emoji || '❤️',
    photo: data.photo || undefined,
    dateLabel: data.date || data.dateLabel || undefined,
    music: data.music === '1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const keep = () => {
    const list = load<LoveCard[]>(KEYS.cards, []);
    save(KEYS.cards, [card, ...list]);
  };
  return (
    <>
      <CardPreview card={card} />
      {card.music && (
        <p style={{ textAlign: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (musicOn) {
                stopLullaby();
                setMusicOn(false);
              } else {
                startLullaby();
                setMusicOn(true);
              }
            }}
          >
            {musicOn ? '⏸ Stop our tune' : '🔔 Play our tune'}
          </button>
        </p>
      )}
      <p style={{ textAlign: 'center' }}>
        <button className="btn btn-ink btn-sm" onClick={keep}>
          💾 Keep this card on my device
        </button>
      </p>
    </>
  );
}

/* ---------------- coupon ---------------- */

function ReceivedCoupon({ data }: { data: Record<string, string> }): React.ReactElement {
  return (
    <article className="coupon">
      <p className="eyebrow">A coupon, just for you 🎟️</p>
      <h2 style={{ margin: '0.2rem 0' }}>{data.title || 'A lovely coupon'}</h2>
      {data.description && <p>{data.description}</p>}
      <p className="code">{data.code}</p>
      {data.expiry && <p className="hint">Valid until {data.expiry}</p>}
      <p className="notice">
        Coupons you receive live inside this link — screenshot this screen so you can flash it when the moment comes. 😄
      </p>
    </article>
  );
}

/* ---------------- memory ---------------- */

function ReceivedMemory({ data }: { data: Record<string, string> }): React.ReactElement {
  return (
    <article className="feature-card memory-card">
      <p className="eyebrow">A memory, shared with you 📸</p>
      {data.photo && <img src={data.photo} alt={`Shared memory: ${data.title}`} />}
      <h2 style={{ margin: '0.4rem 0' }}>{data.title || 'A memory'}</h2>
      <p className="hint">
        📅 {data.date} {data.location ? `· 📍 ${data.location}` : ''}
      </p>
      {data.description && <p style={{ whiteSpace: 'pre-wrap' }}>{data.description}</p>}
      {data.tags && <p className="hint">#{data.tags.split(',').join(' #')}</p>}
    </article>
  );
}

/* ---------------- capsule ---------------- */

function ReceivedCapsule({ data }: { data: Record<string, string> }): React.ReactElement {
  const [pass, setPass] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const cap = {
    id: data.id || 'shared',
    title: data.title || 'A note from the past',
    sealed: data.sealed || '',
    unlockAt: Number(data.unlockAt) || 0,
    hint: data.hint || undefined,
    hasPassphrase: data.hasPassphrase === '1',
    createdAt: Date.now(),
  };
  const unlocked = isUnlocked(cap);

  const open = async () => {
    setError('');
    try {
      setText(await unsealCapsule(cap, pass));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open.');
    }
  };

  return (
    <div className="panel capsule-locked">
      <p className="eyebrow">A message from the past ⏳</p>
      <h2 style={{ fontFamily: 'var(--font-display)' }}>{cap.title}</h2>
      {!unlocked ? (
        <>
          <div className="lock" aria-hidden="true">
            🔒
          </div>
          <p>
            Still sealed — unlocks <strong>{new Date(cap.unlockAt).toLocaleString()}</strong> (
            {lockRemaining(cap.unlockAt)}).
          </p>
          {cap.hint && <p><em>Hint: {cap.hint}</em></p>}
          <p className="hint">Come back on the day. It’ll be worth the wait. ❤️</p>
        </>
      ) : text ? (
        <blockquote style={{ borderLeft: '3px solid var(--accent)', textAlign: 'left', paddingLeft: '0.8rem', whiteSpace: 'pre-wrap' }}>
          {text}
        </blockquote>
      ) : (
        <>
          <div style={{ fontSize: '3rem' }} aria-hidden="true">
            💌
          </div>
          <p>It’s time — your message is ready.</p>
          {cap.hasPassphrase && (
            <input type="password" className="input" placeholder="Passphrase" aria-label="Capsule passphrase" value={pass} onChange={(e) => setPass(e.target.value)} style={{ marginBottom: '0.6rem' }} />
          )}
          {error && <p className="notice bad">{error}</p>}
          <button className="btn btn-primary" onClick={() => void open()}>
            💌 Open our message
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- games ---------------- */

function ReceivedGame({ data }: { data: Record<string, string> }): React.ReactElement {
  const game = data.game;
  if (game === 'know-me') return <KnowMeChallenge data={data} />;
  if (game === 'this-or-that') return <ThisOrThatChallenge data={data} />;
  if (game === 'who-said-it') return <WhoSaidItChallenge data={data} />;
  return <p className="notice bad">Unknown game challenge.</p>;
}

function KnowMeChallenge({ data }: { data: Record<string, string> }): React.ReactElement {
  const ids = parseJsonArray(data.questionIds);
  const self = parseJsonRecord(data.self);
  const from = data.from || 'Your partner';
  const questions = ids.map((id) => KNOW_ME_QUESTIONS.find((q) => q.id === id)).filter((q) => !!q);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  if (questions.length === 0) return <p className="notice bad">This challenge is empty.</p>;
  const score = scoreKnowMe(self, guesses, ids);
  return (
    <div className="panel">
      <p className="eyebrow">Game challenge 🧠</p>
      <h2 style={{ marginTop: 0 }}>{from} answered {questions.length} questions about themselves.</h2>
      <p>Guess how they answered — then reveal and count your matches.</p>
      {questions.map((q, i) => (
        <div className="field" key={q!.id}>
          <label htmlFor={`cg-${q!.id}`}>{i + 1}. {q!.prompt}</label>
          <input
            id={`cg-${q!.id}`}
            className="input"
            value={guesses[q!.id] ?? ''}
            maxLength={300}
            disabled={done}
            onChange={(e) => setGuesses({ ...guesses, [q!.id]: e.target.value })}
          />
          {done && (
            <span className="hint">
              {score.perQuestion.find((p) => p.id === q!.id)?.match ? '✅' : '❌'} {from} wrote: “{self[q!.id]}”
            </span>
          )}
        </div>
      ))}
      {!done ? (
        <button className="btn btn-primary" onClick={() => setDone(true)}>
          Reveal our score →
        </button>
      ) : (
        <p className="notice good">
          You matched {score.matches}/{score.total}! {from}, your move — send one back. ❤️
        </p>
      )}
    </div>
  );
}

function ThisOrThatChallenge({ data }: { data: Record<string, string> }): React.ReactElement {
  const ids = parseJsonArray(data.pairIds);
  const senderPicks = parseJsonRecord(data.picks);
  const from = data.from || 'Your partner';
  const pairs = ids.map((id) => THIS_OR_THAT_PAIRS.find((p) => p.id === id)).filter((p) => !!p);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  if (pairs.length === 0) return <p className="notice bad">This challenge is empty.</p>;
  const score = scoreThisOrThat(senderPicks, mine, ids);
  return (
    <div className="panel">
      <p className="eyebrow">Game challenge ⚖️</p>
      <h2 style={{ marginTop: 0 }}>{from} picked their sides. Now you.</h2>
      {pairs.map((pair) => (
        <div key={pair!.id} className="share-box" style={{ marginBottom: '0.7rem' }}>
          {([pair!.a, pair!.b] as const).map((side) => (
            <button
              key={side}
              className="quiz-opt"
              style={{ flex: 1, marginBottom: 0 }}
              aria-pressed={mine[pair!.id] === side}
              disabled={done}
              onClick={() => setMine({ ...mine, [pair!.id]: side })}
            >
              {side}
            </button>
          ))}
        </div>
      ))}
      {!done ? (
        <button className="btn btn-primary" disabled={Object.keys(mine).length < pairs.length} onClick={() => setDone(true)}>
          Reveal our overlap →
        </button>
      ) : (
        <div>
          <p className="notice good">
            {score.matches}/{score.total} in sync! {overlapLabel(score.matches, score.total)}
          </p>
          {pairs.map((pair) => (
            <p key={pair!.id} className="hint">
              {senderPicks[pair!.id] === mine[pair!.id] ? '💛' : '😄'} {from}: {senderPicks[pair!.id]} · You:{' '}
              {mine[pair!.id]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function WhoSaidItChallenge({ data }: { data: Record<string, string> }): React.ReactElement {
  const from = data.from || 'Your partner';
  const statements = useMemo(() => {
    try {
      const v: unknown = JSON.parse(data.statements || '[]');
      if (!Array.isArray(v)) return [];
      return v
        .map((s, i) => {
          const r = s as Record<string, unknown>;
          const text = cleanText(String(r.text ?? ''), 140);
          const author: Person = r.author === 'you' ? 'you' : 'me';
          return text ? { id: `${i}:${text}`, text, author } : null;
        })
        .filter((x): x is { id: string; text: string; author: Person } => !!x)
        .slice(0, 20);
    } catch {
      return [];
    }
  }, [data.statements]);
  const [guesses, setGuesses] = useState<Record<string, Person>>({});
  const [done, setDone] = useState(false);
  if (statements.length === 0) return <p className="notice bad">This challenge is empty.</p>;
  const score = scoreWhoSaidIt(statements, guesses);
  return (
    <div className="panel">
      <p className="eyebrow">Game challenge 🫣</p>
      <h2 style={{ marginTop: 0 }}>{from} wrote {statements.length} statements. Who’s who?</h2>
      {statements.map((s) => (
        <div key={s.id} className="share-box" style={{ marginBottom: '0.7rem', alignItems: 'center' }}>
          <span style={{ flex: 2 }}>“{s.text}”</span>
          {(['me', 'you'] as const).map((side) => (
            <button
              key={side}
              className={`btn btn-sm ${guesses[s.id] === side ? 'btn-ink' : 'btn-ghost'}`}
              disabled={done}
              onClick={() => setGuesses({ ...guesses, [s.id]: side })}
            >
              {side === 'me' ? `🙋 ${from}` : '👉 YOU'}
            </button>
          ))}
          {done && <span className="hint">{guesses[s.id] === s.author ? '✅' : `❌ (was ${s.author === 'me' ? from : 'you'})`}</span>}
        </div>
      ))}
      {!done ? (
        <button className="btn btn-primary" disabled={Object.keys(guesses).length < statements.length} onClick={() => setDone(true)}>
          Reveal →
        </button>
      ) : (
        <p className="notice good">
          {score.correct}/{score.total} right! Rematch? Send one back. ❤️
        </p>
      )}
    </div>
  );
}

/* ---------------- sticker & pack ---------------- */

function ReceivedSticker({ data }: { data: Record<string, string> }): React.ReactElement {
  const saveImage = () => {
    const a = document.createElement('a');
    a.href = data.image;
    a.download = 'lovekit-sticker.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <p className="eyebrow">A sticker, handmade for you 😍</p>
      <h2 style={{ marginTop: 0 }}>{data.name || 'A sticker'}</h2>
      {data.image && (
        <img src={data.image} alt={`Sticker: ${data.name}`} style={{ width: 'min(100%, 320px)', imageRendering: 'auto' }} />
      )}
      <p>
        <button className="btn btn-primary btn-sm" onClick={saveImage}>
          ⬇ Download PNG (512×512)
        </button>
      </p>
      <p className="hint">Then import it into WhatsApp via any sticker-maker app. ❤️</p>
    </div>
  );
}

function ReceivedPack({ data }: { data: Record<string, string> }): React.ReactElement {
  const names = asSafeList({ stickers: parseJsonArray(data.stickers) }, 'stickers');
  return (
    <div className="panel">
      <p className="eyebrow">A whole sticker pack 📦❤️</p>
      <h2 style={{ marginTop: 0 }}>{data.name || 'A sticker pack'}</h2>
      <p>by {data.author || 'someone who adores you'}</p>
      {data.description && <p>{data.description}</p>}
      {names.length > 0 && (
        <ul>
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="notice warn">
        Sticker files are too big for links — ask your person to send the PNGs directly, then import them with a
        sticker-maker app. This link is the card that says “I made you a whole pack”. 💝
      </p>
    </div>
  );
}
