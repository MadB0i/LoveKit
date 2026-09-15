import { Link } from 'react-router-dom';

export default function NotFound(): React.ReactElement {
  return (
    <div className="empty" style={{ paddingTop: '4rem' }}>
      <span className="big">💔</span>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>This page wandered off…</h1>
      <p>…like socks in a dryer. Let’s get you back to something lovely.</p>
      <p>
        <Link className="btn btn-primary" to="/">
          Take me home ❤️
        </Link>
      </p>
    </div>
  );
}
