import React from 'react';
import { KEYS } from '../lib/store';

interface State {
  error: string | null;
  confirmReset: boolean;
}

/**
 * ErrorBoundary — the last line of defence against corrupt state.
 * If anything in the tree throws during render, users get a humane screen
 * (never a blank page), plus a clearly-labelled last-resort data reset.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, confirmReset: false };

  static getDerivedStateFromError(err: unknown): State {
    return { error: err instanceof Error ? err.message : 'Something broke.', confirmReset: false };
  }

  componentDidCatch(): void {
    /* No remote logging — privacy first. The message below is all the user needs. */
  }

  private resetData = () => {
    try {
      const doomed = Object.values(KEYS);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (doomed.some((d) => k === d) || k.startsWith('lovekit.'))) localStorage.removeItem(k);
      }
      sessionStorage.clear();
    } catch {
      /* best effort */
    }
    window.location.hash = '#/';
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="shell">
        <main className="wrap" style={{ paddingTop: '4rem', maxWidth: 560 }}>
          <div className="panel" role="alert" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }} aria-hidden="true">
              💝
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)' }}>Oh no — LoveKit stumbled</h1>
            <p style={{ color: 'var(--ink-soft)' }}>
              This is usually a hiccup in saved data, not lost love. Try reloading first.
            </p>
            <div className="share-box" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                ↻ Reload
              </button>
              {!this.state.confirmReset ? (
                <button className="btn btn-ghost" onClick={() => this.setState({ confirmReset: true })}>
                  Reset app data…
                </button>
              ) : (
                <button className="btn btn-danger" onClick={this.resetData}>
                  Yes, erase on-device data & restart
                </button>
              )}
            </div>
            {this.state.confirmReset && (
              <p className="notice warn" style={{ marginTop: '0.8rem' }}>
                This erases cards, stickers, memories, coupons and capsules stored on THIS device. Exported files
                and share links you already sent are unaffected.
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }
}
