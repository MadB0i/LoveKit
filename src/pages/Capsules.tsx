import { useState } from 'react';
import ShareBox from '../components/ShareBox';
import { exportLocalKey, isUnlocked, lockRemaining, sealCapsule, unsealCapsule } from '../lib/capsules';
import { cleanText } from '../lib/sanitize';
import { KEYS, load, save } from '../lib/store';
import type { TimeCapsule } from '../lib/types';

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Capsules(): React.ReactElement {
  const [items, setItems] = useState<TimeCapsule[]>(() => load<TimeCapsule[]>(KEYS.capsules, []));
  const [form, setForm] = useState({
    title: '',
    message: '',
    when: toLocalInput(Date.now() + 30 * 86_400_000),
    hint: '',
    passphrase: '',
  });
  const [notice, setNotice] = useState<{ kind: 'good' | 'bad' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [passInputs, setPassInputs] = useState<Record<string, string>>({});

  const persist = (list: TimeCapsule[]) => {
    setItems(list);
    if (!save(KEYS.capsules, list).ok) setNotice({ kind: 'bad', text: 'Storage is full — copy your message somewhere safe!' });
  };

  const seal = async () => {
    const unlockAt = new Date(form.when).getTime();
    if (!cleanText(form.message, 5000)) {
      setNotice({ kind: 'bad', text: 'Write the message first — future-you is waiting.' });
      return;
    }
    if (!Number.isFinite(unlockAt) || unlockAt <= Date.now()) {
      setNotice({ kind: 'bad', text: 'Pick a moment in the future. Even tomorrow counts.' });
      return;
    }
    setBusy(true);
    try {
      const cap = await sealCapsule({
        title: form.title || 'A note from the past',
        message: form.message,
        unlockAt,
        hint: form.hint,
        passphrase: form.passphrase || undefined,
      });
      persist([cap, ...items]);
      setForm({ title: '', message: '', when: toLocalInput(Date.now() + 30 * 86_400_000), hint: '', passphrase: '' });
      setNotice({
        kind: 'good',
        text: form.passphrase
          ? 'Sealed with your passphrase. Truly unreadable until the day — and without the words. 🔒'
          : 'Sealed! Locked in the UI until the day. Note: without a passphrase, someone with your unlocked device could technically dig it out early — add a passphrase for real secrecy.',
      });
    } catch (e) {
      setNotice({ kind: 'bad', text: e instanceof Error ? e.message : 'Sealing failed.' });
    } finally {
      setBusy(false);
    }
  };

  const open = async (cap: TimeCapsule) => {
    setNotice(null);
    try {
      const text = await unsealCapsule(cap, passInputs[cap.id] ?? '');
      setRevealed((r) => ({ ...r, [cap.id]: text }));
    } catch (e) {
      setNotice({ kind: 'bad', text: e instanceof Error ? e.message : 'Could not open.' });
    }
  };

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>⏳ Time capsules</h1>
        <p>“If we’re still us in 2030, I hope we remember…” — seal it, wait, weep happily.</p>
      </div>
      {notice && <p className={`notice ${notice.kind === 'good' ? 'good' : notice.kind === 'warn' ? 'warn' : 'bad'}`} role="status">{notice.text}</p>}

      <div className="stage">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Seal a message to the future</h3>
          <div className="field">
            <label htmlFor="cap-title">Title</label>
            <input id="cap-title" className="input" placeholder="To us, one year from now" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cap-msg">The message</label>
            <textarea id="cap-msg" className="textarea" placeholder="Dear future us…" value={form.message} maxLength={5000} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cap-when">Unlock on</label>
            <input id="cap-when" type="datetime-local" className="input" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cap-hint">Public hint <span className="hint">(visible while locked, e.g. “open with hot chocolate”)</span></label>
            <input id="cap-hint" className="input" value={form.hint} maxLength={200} onChange={(e) => setForm({ ...form, hint: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cap-pass">Passphrase <span className="hint">(optional — makes it genuinely unreadable without these words)</span></label>
            <input id="cap-pass" type="password" autoComplete="new-password" className="input" placeholder="A secret phrase you’ll both remember" value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={() => void seal()} disabled={busy}>
            {busy ? 'Sealing…' : '🔒 Seal it'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          {items.length === 0 && (
            <div className="empty panel">
              <span className="big">⏳</span>
              <p>No capsules yet. Your future selves are waiting for mail.</p>
            </div>
          )}
          {items.map((cap) => {
            const unlocked = isUnlocked(cap);
            const text = revealed[cap.id];
            return (
              <article key={cap.id} className="panel">
                <h3 style={{ marginTop: 0 }}>
                  {unlocked ? '💌' : '🔒'} {cap.title}
                </h3>
                <p className="hint" style={{ fontSize: '0.85rem' }}>
                  Unlocks {new Date(cap.unlockAt).toLocaleString()} ·{' '}
                  {unlocked ? 'open!' : lockRemaining(cap.unlockAt)}
                  {cap.hasPassphrase ? ' · 🔑 passphrase protected' : ''}
                </p>
                {!unlocked && cap.hint && <p><em>Hint: {cap.hint}</em></p>}
                {!unlocked && (
                  <p className="notice">Still sealed. The message is stored as ciphertext — it isn’t rendered anywhere until the day. Good things take time. 🔒</p>
                )}
                {unlocked && !text && (
                  <div className="share-box">
                    {cap.hasPassphrase && (
                      <input
                        type="password"
                        className="input"
                        placeholder="Passphrase"
                        aria-label={`Passphrase for ${cap.title}`}
                        value={passInputs[cap.id] ?? ''}
                        onChange={(e) => setPassInputs({ ...passInputs, [cap.id]: e.target.value })}
                      />
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => void open(cap)}>
                      💌 Open our message
                    </button>
                  </div>
                )}
                {unlocked && text && (
                  <blockquote style={{ borderLeft: '3px solid var(--accent)', margin: '0.6rem 0', paddingLeft: '0.8rem', whiteSpace: 'pre-wrap' }}>
                    {text}
                  </blockquote>
                )}
                <div className="share-box" style={{ marginTop: '0.6rem' }}>
                  <ShareBox
                    kind="capsule"
                    label="time capsule"
                    buildPayload={() => ({
                      id: cap.id,
                      title: cap.title,
                      sealed: cap.sealed,
                      unlockAt: String(cap.unlockAt),
                      hint: cap.hint ?? '',
                      hasPassphrase: cap.hasPassphrase ? '1' : '',
                      ...(!cap.hasPassphrase ? { key: exportLocalKey(cap.id) } : {}),
                    })}
                  />
                  <button className="btn btn-sm btn-danger" onClick={() => persist(items.filter((x) => x.id !== cap.id))}>
                    Delete
                  </button>
                </div>
                {!cap.hasPassphrase && (
                  <p className="hint" style={{ fontSize: '0.8rem' }}>
                    Sharing note: a no-passphrase link carries its own key, so treat it like a sealed letter — the app
                    hides the words until the date, but anyone tech-savvy holding the link could peek. For real secrecy,
                    use a passphrase.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
