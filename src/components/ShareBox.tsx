import { useMemo, useState } from 'react';
import { buildShareUrl, encodeShare, SHARE_COMFORTABLE_LIMIT, type ShareKind } from '../lib/share';

/**
 * ShareBox — "You received something from someone who loves you ❤️".
 * Encodes any JSON-able payload into a `#/l/<code>` link. No accounts,
 * no server. Warns honestly when photos make a link too long, and offers
 * a compact photo-free alternative.
 */
export default function ShareBox({
  kind,
  label,
  buildPayload,
  hasPhotos,
}: {
  kind: ShareKind;
  label: string;
  buildPayload: (includePhotos: boolean) => unknown;
  hasPhotos?: boolean;
}): React.ReactElement {
  const [withPhotos, setWithPhotos] = useState(true);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const { code, url, tooLong } = useMemo(() => {
    try {
      const c = encodeShare(kind, buildPayload(withPhotos));
      return { code: c, url: buildShareUrl(c), tooLong: c.length > SHARE_COMFORTABLE_LIMIT };
    } catch {
      return { code: '', url: '', tooLong: false };
    }
  }, [kind, withPhotos]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!revealed) {
    return (
      <button className="btn btn-ink" onClick={() => setRevealed(true)}>
        🔗 Create shareable surprise link
      </button>
    );
  }

  return (
    <div className="panel" aria-label={`Share this ${label}`}>
      <h3 style={{ marginTop: 0 }}>🔗 Your surprise link</h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginTop: 0 }}>
        Anyone with this link sees a gift-wrapped reveal — no account needed. Links never touch our servers (there
        are none); everything lives in the link itself.
      </p>
      {hasPhotos && (
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem', marginBottom: '0.7rem' }}>
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
          Include photo in the link (bigger link, may not paste everywhere)
        </label>
      )}
      {tooLong && (
        <p className="notice warn" role="alert">
          This link is long ({(code.length / 1024).toFixed(1)} KB) — some chat apps truncate long messages.
          {hasPhotos && withPhotos ? ' Try turning the photo off, or share the downloaded file instead.' : ' Share the downloaded file instead.'}
        </p>
      )}
      <div className="share-box">
        <input className="input share-link" readOnly value={url} aria-label="Shareable link" onFocus={(e) => e.target.select()} />
        <button className="btn btn-primary btn-sm" onClick={() => void copy()}>
          {copied ? '✓ Copied!' : 'Copy link'}
        </button>
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      </div>
    </div>
  );
}
