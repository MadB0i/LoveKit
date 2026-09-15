import { Link } from 'react-router-dom';

export default function Privacy(): React.ReactElement {
  return (
    <div style={{ maxWidth: 720 }}>
      <p className="eyebrow" style={{ marginTop: '2rem' }}>
        Privacy
      </p>
      <h1 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Your love life stays yours.</h1>
      <p className="lede" style={{ margin: '0 0 1.5rem' }}>
        LoveKit has no servers, no accounts and no analytics. Here is exactly what happens to your words and photos.
      </p>
      <ol className="steps">
        <li>
          <span>
            <strong>On your device, by default.</strong> Cards, stickers, memories, coupons, capsules and game answers
            live in your browser’s local storage. Clearing site data removes them — export anything precious.
          </span>
        </li>
        <li>
          <span>
            <strong>Photos never upload.</strong> Uploads are resized on-device. Photos only leave your phone if YOU
            put them in a share link or download them to send elsewhere.
          </span>
        </li>
        <li>
          <span>
            <strong>Share links contain the gift, not a pointer.</strong> A surprise link packs the message into the
            URL itself. Anyone holding the link can read it — send links like sealed letters, only to your person.
          </span>
        </li>
        <li>
          <span>
            <strong>Time capsules lock the UI, not physics.</strong> Without a passphrase, a determined person with
            your unlocked device could dig the words out early. With a passphrase (AES-GCM, 120k PBKDF2 rounds), not
            even we could read it — because there is no “we”.
          </span>
        </li>
        <li>
          <span>
            <strong>Writing help is offline first.</strong> The built-in helper runs entirely on your device. If you
            connect your own AI endpoint, only text you approve is sent — never photos — and your key stays in your
            browser.
          </span>
        </li>
        <li>
          <span>
            <strong>No secrets in the code.</strong> There are no API keys, no trackers and no third-party scripts.
            Everything is open source — don’t trust us, read it.
          </span>
        </li>
      </ol>
      <p>
        <Link className="btn btn-ghost" to="/">
          ← Back home
        </Link>
      </p>
    </div>
  );
}
