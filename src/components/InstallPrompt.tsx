import { useEffect, useState } from 'react';
import {
  dismissInstall,
  isIOS,
  isStandalone,
  wasInstallDismissed,
  type BeforeInstallPromptEvent,
} from '../lib/pwa';

/**
 * InstallPrompt — a subtle, one-time install invitation. Never nags:
 * - Only appears when the platform actually offers installation (Chromium
 *   `beforeinstallprompt`) or on iOS with manual steps.
 * - Dismissal is remembered forever. Installed state hides it forever.
 */
export default function InstallPrompt(): React.ReactElement | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => wasInstallDismissed());
  const [installed, setInstalled] = useState(() => isStandalone());
  const [busy, setBusy] = useState(false);
  const showIOS = !isStandalone() && isIOS();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      dismissInstall();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferred && !showIOS) return null;

  const hide = () => {
    dismissInstall();
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      else hide();
    } catch {
      hide();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel install-card" aria-label="Install LoveKit">
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.8rem' }} aria-hidden="true">
          📲
        </span>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.2rem' }}>Install LoveKit?</h3>
          <p style={{ margin: '0 0 0.7rem', fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            Faster launch · works offline · feels like an app · your words stay on your device.
            {showIOS && !deferred && ' On iPhone: tap Share, then “Add to Home Screen”.'}
          </p>
          <div className="share-box">
            {!showIOS && deferred && (
              <button className="btn btn-primary btn-sm" onClick={() => void install()} disabled={busy}>
                {busy ? '…' : '⬇ Install'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={hide}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
