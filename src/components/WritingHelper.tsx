import { useState } from 'react';
import {
  APOLOGY_QUESTIONS,
  CustomEndpointProvider,
  DISCUSSION_STARTERS,
  LocalWritingProvider,
  buildApology,
  pickStarters,
  type ApologyAnswers,
  type WritingTone,
} from '../lib/ai';
import { cleanText } from '../lib/sanitize';

const TONES: { id: WritingTone; label: string; hint: string }[] = [
  { id: 'shorter', label: '✂️ Shorter', hint: 'Keep the heart, lose the ramble' },
  { id: 'warmer', label: '🧣 Warmer', hint: 'Softer landing' },
  { id: 'playful', label: '😄 Playful', hint: 'Add a wink' },
  { id: 'calmer', label: '🌊 Calmer', hint: 'For heated moments' },
  { id: 'formal', label: '💼 Polished', hint: 'For the in-laws, maybe' },
];

/**
 * WritingHelper — AI-assisted heartfelt writing WITHOUT an AI partner.
 * Always edits the user's own draft; the "apology guide" asks questions
 * first and composes from the user's answers.
 */
export default function WritingHelper({
  value,
  onApply,
  context,
  toName,
  fromName,
}: {
  value: string;
  onApply: (next: string) => void;
  context?: string;
  toName?: string;
  fromName?: string;
}): React.ReactElement {
  const [busy, setBusy] = useState<WritingTone | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'tones' | 'apology' | 'ideas'>('tones');
  const [answers, setAnswers] = useState<ApologyAnswers>({ what: '', impact: '', own: '', change: '' });
  const [starters, setStarters] = useState<string[]>(DISCUSSION_STARTERS.slice(0, 4));
  const [endpoint, setEndpoint] = useState(() => {
    try {
      return localStorage.getItem('lovekit.ai.endpoint') || '';
    } catch {
      return '';
    }
  });
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('lovekit.ai.key') || '';
    } catch {
      return '';
    }
  });
  const [useCustom, setUseCustom] = useState(false);

  const runTone = async (tone: WritingTone) => {
    setBusy(tone);
    setError('');
    try {
      const provider =
        useCustom && endpoint && apiKey
          ? new CustomEndpointProvider(endpoint, apiKey)
          : new LocalWritingProvider();
      const out = await provider.transform({ text: value, tone, context });
      onApply(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const saveAiConfig = () => {
    try {
      localStorage.setItem('lovekit.ai.endpoint', endpoint);
      localStorage.setItem('lovekit.ai.key', apiKey);
    } catch {
      /* private mode */
    }
  };

  return (
    <div className="panel" aria-label="Writing helper">
      <div className="chips" role="tablist" aria-label="Helper modes">
        <button className="chip" role="tab" aria-selected={mode === 'tones'} aria-pressed={mode === 'tones'} onClick={() => setMode('tones')}>
          ✨ Polish my words
        </button>
        <button className="chip" role="tab" aria-selected={mode === 'apology'} aria-pressed={mode === 'apology'} onClick={() => setMode('apology')}>
          🥺 Apology guide
        </button>
        <button className="chip" role="tab" aria-selected={mode === 'ideas'} aria-pressed={mode === 'ideas'} onClick={() => setMode('ideas')}>
          💬 Things to talk about
        </button>
      </div>

      {mode === 'tones' && (
        <div style={{ marginTop: '0.9rem' }}>
          <p style={{ margin: '0 0 0.7rem', fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            Start with your own messy draft — the helper only reshapes <em>your</em> words. Works offline.
          </p>
          <div className="chips">
            {TONES.map((t) => (
              <button key={t.id} className="chip" title={t.hint} disabled={!value.trim() || busy !== null} onClick={() => void runTone(t.id)}>
                {busy === t.id ? '…' : t.label}
              </button>
            ))}
          </div>
          {error && (
            <p className="notice bad" role="alert" style={{ marginTop: '0.7rem' }}>
              {error}
            </p>
          )}
          <details style={{ marginTop: '0.9rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}>
              Optional: connect your own AI endpoint (BYO key)
            </summary>
            <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)' }}>
              Keys stay in <em>your</em> browser only — never in our code, because there is no server. Only the text
              you approve is sent, never photos.
            </p>
            <div className="field">
              <label htmlFor="ai-endpoint">Endpoint (https OpenAI-compatible chat URL)</label>
              <input
                id="ai-endpoint"
                className="input"
                inputMode="url"
                placeholder="https://…"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ai-key">API key</label>
              <input
                id="ai-key"
                className="input"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="share-box">
              <button className="btn btn-ghost btn-sm" onClick={saveAiConfig}>
                Save on this device
              </button>
              <label style={{ fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} /> Use it
                for the tones above
              </label>
            </div>
          </details>
        </div>
      )}

      {mode === 'apology' && (
        <div style={{ marginTop: '0.9rem' }}>
          <p style={{ margin: '0 0 0.7rem', fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            Good apologies have four parts. Answer honestly — your answers become the message.
          </p>
          {APOLOGY_QUESTIONS.map((q) => (
            <div className="field" key={q.id}>
              <label htmlFor={`apo-${q.id}`}>{q.label}</label>
              <textarea
                id={`apo-${q.id}`}
                className="textarea"
                style={{ minHeight: 64 }}
                placeholder={q.hint}
                value={answers[q.id as keyof ApologyAnswers]}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            </div>
          ))}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onApply(buildApology(toName ?? '', fromName ?? '', answers))}
            disabled={!cleanText(answers.what, 500) && !cleanText(answers.own, 500)}
          >
            Compose from my answers →
          </button>
        </div>
      )}

      {mode === 'ideas' && (
        <div style={{ marginTop: '0.9rem' }}>
          <ul style={{ paddingLeft: '1.2rem', margin: '0 0 0.8rem', display: 'grid', gap: '0.4rem' }}>
            {starters.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <button className="btn btn-ghost btn-sm" onClick={() => setStarters(pickStarters(4))}>
            🎲 Deal new questions
          </button>
        </div>
      )}
    </div>
  );
}
