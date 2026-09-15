import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { applySWUpdate, consumeInboundShare, registerSW, useOnline } from '../lib/pwa';
import { KEYS, loadSettings, save, type AppSettings } from '../lib/store';

function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
}

export function useSettings(): [AppSettings, (s: AppSettings) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  useEffect(() => {
    applyTheme(settings.theme);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    save(KEYS.settings, settings);
  }, [settings]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(loadSettings().theme);
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
  const online = useOnline();
  const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(null);
  const cycleTheme = () => {
    const next = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    setSettings({ ...settings, theme: next });
  };
  // PWA: register worker, listen for version updates, swallow inbound shares.
  useEffect(() => {
    registerSW((reg) => setUpdateReg(reg));
    consumeInboundShare();
    const onController = () => window.location.reload();
    navigator.serviceWorker?.addEventListener?.('controllerchange', onController);
    return () => navigator.serviceWorker?.removeEventListener?.('controllerchange', onController);
  }, []);
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
        {!online && (
          <p className="notice warn offline-bar" role="status">
            📴 You’re offline — everything on this device still works (studio, stickers, games, memories, capsules).
            Only the optional custom AI endpoint needs internet.
          </p>
        )}
        {updateReg && (
          <div className="notice good update-bar" role="status">
            ✨ A fresh LoveKit is ready.{' '}
            <button
              className="btn btn-sm btn-ink"
              onClick={() => applySWUpdate(updateReg)}
            >
              Update now
            </button>
          </div>
        )}
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
