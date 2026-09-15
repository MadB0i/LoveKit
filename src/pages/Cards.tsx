import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import ShareBox from '../components/ShareBox';
import WritingHelper from '../components/WritingHelper';
import { THEMES } from '../data/themes';
import { CARD_CATEGORIES, TEMPLATES, categoryLabel, fillTemplate } from '../data/templates';
import { downloadCardPng } from '../lib/cardExport';
import { downscaleDataUrl, fileToDataUrl } from '../lib/images';
import { startLullaby, stopLullaby } from '../lib/music';
import { cleanName, cleanText } from '../lib/sanitize';
import { KEYS, load, save, uid } from '../lib/store';
import type { CardAnimation, CardEffect, LoveCard } from '../lib/types';

const EFFECTS: { id: CardEffect; label: string }[] = [
  { id: 'hearts', label: '❤️ Hearts' },
  { id: 'float-emoji', label: '✨ Floating emoji' },
  { id: 'confetti', label: '🎉 Confetti' },
  { id: 'sparkles', label: '✦ Sparkles' },
];

const ANIMATIONS: { id: CardAnimation; label: string }[] = [
  { id: 'reveal', label: 'Soft reveal' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'hearts', label: 'Rising hearts' },
  { id: 'confetti', label: 'Confetti burst' },
  { id: 'sparkles', label: 'Sparkle shimmer' },
  { id: 'none', label: 'Still & calm' },
];

const EMOJIS = ['❤️', '💋', '🌙', '☀️', '✨', '🥺', '💐', '♾️', '🦋', '🌹', '🍂', '🌊'];

function blankCard(): LoveCard {
  const now = Date.now();
  return {
    id: uid('card'),
    category: 'just-because',
    toName: '',
    fromName: '',
    message: '',
    themeId: 'ember',
    effects: ['hearts'],
    animation: 'reveal',
    emoji: '❤️',
    createdAt: now,
    updatedAt: now,
  };
}

export default function Cards(): React.ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<LoveCard[]>(() => load<LoveCard[]>(KEYS.cards, []));
  const [card, setCard] = useState<LoveCard>(blankCard);
  const [notice, setNotice] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [sharePhoto, setSharePhoto] = useState<string | undefined>(undefined);

  // Load a saved card when the route carries an id.
  useEffect(() => {
    if (!id) return;
    const found = load<LoveCard[]>(KEYS.cards, []).find((c) => c.id === id);
    if (found) {
      setCard(found);
      setNotice(null);
    }
  }, [id]);

  // Keep a link-sized copy of the photo for share URLs.
  useEffect(() => {
    let alive = true;
    setSharePhoto(undefined);
    if (!card.photo) return;
    downscaleDataUrl(card.photo, { maxDim: 420, quality: 0.62 })
      .then((small) => {
        if (alive) setSharePhoto(small);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [card.photo]);

  useEffect(() => () => stopLullaby(), []);

  const set = <K extends keyof LoveCard>(key: K, value: LoveCard[K]) =>
    setCard((c) => ({ ...c, [key]: value, updatedAt: Date.now() }));

  const toggleEffect = (e: CardEffect) =>
    setCard((c) => ({
      ...c,
      effects: c.effects.includes(e) ? c.effects.filter((x) => x !== e) : [...c.effects, e],
      updatedAt: Date.now(),
    }));

  const templates = useMemo(() => TEMPLATES.filter((t) => t.category === card.category), [card.category]);

  const persist = (list: LoveCard[]) => {
    setSaved(list);
    const res = save(KEYS.cards, list);
    if (!res.ok) setNotice({ kind: 'bad', text: 'Could not save — browser storage is full or blocked. Download the PNG to keep it safe!' });
  };

  const onSave = () => {
    if (!cleanText(card.message, 5000)) {
      setNotice({ kind: 'bad', text: 'Write your message first — even one honest line beats a perfect blank card.' });
      return;
    }
    const cleaned: LoveCard = {
      ...card,
      toName: cleanName(card.toName),
      fromName: cleanName(card.fromName),
      message: cleanText(card.message, 5000),
      dateLabel: cleanText(card.dateLabel ?? '', 60) || undefined,
    };
    setCard(cleaned);
    const exists = saved.some((s) => s.id === cleaned.id);
    persist(exists ? saved.map((s) => (s.id === cleaned.id ? cleaned : s)) : [cleaned, ...saved]);
    setNotice({ kind: 'good', text: 'Saved on this device. ❤️' });
    navigate(`/cards/${cleaned.id}`, { replace: true });
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ kind: 'bad', text: 'That file is not an image. Try a JPG or PNG.' });
      return;
    }
    setBusy(true);
    try {
      const url = await fileToDataUrl(file, { maxDim: 1000, quality: 0.82 });
      set('photo', url);
      setNotice(null);
    } catch {
      setNotice({ kind: 'bad', text: 'Could not read that photo. Try another one.' });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (!cleanText(card.message, 5000)) {
      setNotice({ kind: 'bad', text: 'Add your message before downloading.' });
      return;
    }
    setBusy(true);
    try {
      await downloadCardPng(card, `lovekit-card-${card.id}.png`);
      setNotice({ kind: 'good', text: 'Downloaded as a 1080×1350 PNG — ready for WhatsApp or printing. ❤️' });
    } catch {
      setNotice({ kind: 'bad', text: 'Download failed in this browser. A screenshot works too!' });
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = (body: string) => {
    const filled = fillTemplate(body, card.toName, card.fromName);
    set('message', filled);
    setPendingTemplate(null);
  };

  const toggleMusic = () => {
    if (musicOn) {
      stopLullaby();
      setMusicOn(false);
    } else {
      startLullaby();
      setMusicOn(true);
    }
  };

  const removeSaved = (cid: string) => {
    persist(saved.filter((s) => s.id !== cid));
    if (id === cid) {
      setCard(blankCard());
      navigate('/cards', { replace: true });
    }
  };

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>💌 Love card studio</h1>
        <p>Your words, beautifully wrapped. Start from a starter — then make it unmistakably yours.</p>
      </div>

      {notice && (
        <p className={`notice ${notice.kind === 'good' ? 'good' : 'bad'}`} role={notice.kind === 'good' ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      <div className="stage">
        <div className="panel" aria-label="Card editor">
          <div className="field">
            <label>Occasion</label>
            <div className="chips">
              {CARD_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  aria-pressed={card.category === c.id}
                  title={c.hint}
                  onClick={() => set('category', c.id)}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {templates.length > 0 && (
            <div className="field">
              <label>
                Starters for “{categoryLabel(card.category)}” <span className="hint">— pick one, then edit freely</span>
              </label>
              <div className="chips">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className="chip"
                    aria-pressed={false}
                    title={t.body.slice(0, 120)}
                    onClick={() => (cleanText(card.message, 5000) ? setPendingTemplate(t.id) : applyTemplate(t.body))}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              {pendingTemplate && (
                <p className="notice warn">
                  Replace your current text with this starter?{' '}
                  <button
                    className="btn btn-sm btn-ink"
                    onClick={() => {
                      const t = templates.find((x) => x.id === pendingTemplate);
                      if (t) applyTemplate(t.body);
                    }}
                  >
                    Replace
                  </button>{' '}
                  <button className="btn btn-sm btn-ghost" onClick={() => setPendingTemplate(null)}>
                    Keep mine
                  </button>
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="toName">To</label>
            <input
              id="toName"
              className="input"
              placeholder="Your partner's name"
              value={card.toName}
              maxLength={60}
              onChange={(e) => set('toName', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fromName">From</label>
            <input
              id="fromName"
              className="input"
              placeholder="Your name"
              value={card.fromName}
              maxLength={60}
              onChange={(e) => set('fromName', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="message">Your message</label>
            <textarea
              id="message"
              className="textarea"
              placeholder="Say it like only you can…"
              value={card.message}
              onChange={(e) => set('message', e.target.value)}
              maxLength={5000}
              aria-describedby="msg-count"
            />
            <span className="hint" id="msg-count">
              {card.message.length}/5000 — tip: specific beats sweeping. One true detail beats ten adjectives.
            </span>
          </div>

          <WritingHelper value={card.message} onApply={(next) => set('message', next)} context={card.category} toName={card.toName} fromName={card.fromName} />

          <div className="field" style={{ marginTop: '1rem' }}>
            <label>Theme</label>
            <div className="theme-swatches">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className="swatch"
                  aria-pressed={card.themeId === t.id}
                  aria-label={`Theme ${t.name}: ${t.blurb}`}
                  title={`${t.name} — ${t.blurb}`}
                  onClick={() => set('themeId', t.id)}
                >
                  <span className="s-prev" style={{ background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`, color: t.accent }}>
                    Aa
                  </span>
                  <span className="s-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Magic dust</label>
            <div className="chips">
              {EFFECTS.map((e) => (
                <button key={e.id} className="chip" aria-pressed={card.effects.includes(e.id)} onClick={() => toggleEffect(e.id)}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="anim">Entrance animation</label>
            <select id="anim" className="select" value={card.animation} onChange={(e) => set('animation', e.target.value as CardAnimation)}>
              {ANIMATIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Seal it with</label>
            <div className="chips">
              {EMOJIS.map((e) => (
                <button key={e} className="chip" aria-pressed={card.emoji === e} aria-label={`Seal emoji ${e}`} onClick={() => set('emoji', e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="photo">Photo <span className="hint">(optional, stays on your device)</span></label>
            <input
              id="photo"
              type="file"
              accept="image/*"
              className="input"
              disabled={busy}
              onChange={(e) => void onPhoto(e.target.files?.[0])}
            />
            {card.photo && (
              <button className="btn btn-ghost btn-sm" onClick={() => set('photo', undefined)} style={{ marginTop: '0.4rem' }}>
                Remove photo
              </button>
            )}
          </div>

          <div className="field">
            <label htmlFor="dateLabel">Date line <span className="hint">(optional, e.g. “12 March 2026”)</span></label>
            <input
              id="dateLabel"
              className="input"
              placeholder="A date worth remembering"
              value={card.dateLabel ?? ''}
              maxLength={60}
              onChange={(e) => set('dateLabel', e.target.value)}
            />
          </div>

          <div className="field">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!card.music} onChange={(e) => set('music', e.target.checked)} />
              Attach our little tune 🔔 <span className="hint">(a soft music-box loop)</span>
            </label>
            {card.music && (
              <button className="btn btn-ghost btn-sm" onClick={toggleMusic} style={{ marginTop: '0.4rem' }}>
                {musicOn ? '⏸ Stop preview' : '▶ Preview the tune'}
              </button>
            )}
          </div>

          <div className="share-box" style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={onSave} disabled={busy}>
              💾 Save card
            </button>
            <button className="btn btn-ghost" onClick={() => void onDownload()} disabled={busy}>
              ⬇ PNG
            </button>
            <button className="btn btn-ghost" onClick={() => { stopLullaby(); setMusicOn(false); setCard(blankCard()); navigate('/cards', { replace: true }); }}>
              ＋ New
            </button>
          </div>
        </div>

        <div>
          <CardPreview card={card} />
          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.8rem' }}>
            <ShareBox
              kind="card"
              label="card"
              hasPhotos={!!card.photo}
              buildPayload={(includePhotos) => ({
                category: card.category,
                toName: cleanName(card.toName),
                fromName: cleanName(card.fromName),
                message: cleanText(card.message, 2000),
                themeId: card.themeId,
                effects: card.effects.join(','),
                animation: card.animation,
                emoji: card.emoji,
                dateLabel: cleanText(card.dateLabel ?? '', 60),
                music: card.music ? '1' : '',
                ...(includePhotos && card.photo ? { photo: sharePhoto ?? card.photo } : {}),
              })}
            />
          </div>
        </div>
      </div>

      <section className="section" aria-label="Saved cards">
        <div className="section-head">
          <h2>Your cards</h2>
          <p>{saved.length} saved on this device</p>
        </div>
        {saved.length === 0 ? (
          <div className="empty panel">
            <span className="big">💌</span>
            <p>No cards yet. Your first masterpiece is one honest sentence away.</p>
          </div>
        ) : (
          <div className="grid cols-3">
            {saved.map((s) => (
              <article key={s.id} className="feature-card">
                <h3>
                  {s.emoji} {s.toName || 'My Love'}
                </h3>
                <p>
                  {categoryLabel(s.category)} · {(s.message || '').slice(0, 90)}
                  {(s.message || '').length > 90 ? '…' : ''}
                </p>
                <div className="share-box" style={{ marginTop: '0.5rem' }}>
                  <Link className="btn btn-sm btn-ink" to={`/cards/${s.id}`}>
                    Open
                  </Link>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      const copy = { ...s, id: uid('card'), createdAt: Date.now(), updatedAt: Date.now() };
                      persist([copy, ...saved]);
                    }}
                  >
                    Duplicate
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeSaved(s.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
