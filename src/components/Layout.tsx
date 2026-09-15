import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { DEFAULT_SETTINGS, KEYS, load, save, type AppSettings } from '../lib/store';

function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
}

export function useSettings(): [AppSettings, (s: AppSettings) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => load(KEYS.settings, DEFAULT_SETTINGS));
  useEffect(() => {
    applyTheme(settings.theme);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    save(KEYS.settings, settings);
  }, [settings]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(load(KEYS.settings, DEFAULT_SETTINGS).theme);
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);
  return [settings, setSettings];
}

const LINKS = [
  { to: '/cards', label: '💌 Cards' },
  { to: '/stickers', label: '😍 Stickers' },
  { to: '/games', label: '🎮 Games' },
  { to: '/memories', label: '📸 Memories' },
  { to: '/coupons', label: '🎟️ Coupons' },
  { to: '/capsules', label: '⏳ Capsules' },
];

export default function Layout(): React.ReactElement {
  const [settings, setSettings] = useSettings();
  const cycleTheme = () => {
    const next = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    setSettings({ ...settings, theme: next });
  };
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-in">
          <Link className="brand" to="/" aria-label="LoveKit home">
            <span className="brand-mark" aria-hidden="true">
              ❤️
            </span>
            <span>
              LoveKit
              <small>build moments, not algorithms</small>
            </span>
          </Link>
          <nav className="nav" aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button
            className="icon-btn"
            onClick={cycleTheme}
            title={`Theme: ${settings.theme} (tap to change)`}
            aria-label={`Colour theme, currently ${settings.theme}. Activate to change.`}
          >
            {settings.theme === 'dark' ? '🌙' : settings.theme === 'light' ? '☀️' : '🌓'}
          </button>
        </div>
      </header>
      <main className="wrap" id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap">
          <p>
            <strong>LoveKit ❤️</strong> — the open-source toolkit for meaningful relationships. Your words stay
            yours: everything runs on your device, no accounts, no tracking.{' '}
            <Link to="/privacy">Privacy philosophy</Link> ·{' '}
            <a href="https://github.com/MadB0i/LoveKit" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
