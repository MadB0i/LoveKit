/**
 * pwa.ts — installability, updates, offline awareness, share-target intake.
 *
 * No dependencies, no analytics. Every function fails soft: if the browser
 * can't do PWA things, LoveKit is still a perfectly good website.
 */
import { useEffect, useState } from 'react';
import { cleanText, isSafeExternalUrl } from './sanitize';

export const INSTALL_DISMISSED_KEY = 'lovekit.install.dismissed.v1';
export const INBOUND_SHARE_KEY = 'lovekit.inbound-share.v1';

/** Minimal shape of the (not universally typed) beforeinstallprompt event. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Register the service worker in production only (dev + SW = misery). */
export function shouldRegisterSW(): boolean {
  try {
    return (
      import.meta.env.PROD === true &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window !== 'undefined' &&
      !window.location.protocol.startsWith('file')
    );
  } catch {
    return false;
  }
}

export function registerSW(onUpdate: (reg: ServiceWorkerRegistration) => void): void {
  if (!shouldRegisterSW()) return;
  const run = () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) onUpdate(reg);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) onUpdate(reg);
          });
        });
      })
      .catch(() => {
        /* offline / unsupported — the app works fine without a worker */
      });
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/** Tell a waiting worker to take over (called from the "Update" button). */
export function applySWUpdate(reg: ServiceWorkerRegistration): void {
  try {
    reg.waiting?.postMessage('SKIP_WAITING');
  } catch {
    /* page reload below still picks up fresh assets eventually */
  }
}

export function isStandalone(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    return (navigator as unknown as { standalone?: boolean }).standalone === true; // iOS
  } catch {
    return false;
  }
}

export function isIOS(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
  } catch {
    return false;
  }
}

export function wasInstallDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return true; // storage broken → stay quiet, never nag
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/* ---------------- inbound Web Share Target (GET) ---------------- */

export interface InboundShare {
  title: string;
  text: string;
  url: string;
}

/**
 * Parse `?title=&text=&url=` left by the Web Share Target GET action.
 * Pure + tested. Files are deliberately NOT declared in the manifest:
 * receiving files needs a POST handler, which static hosting cannot do —
 * that waits for the native wrapper (see README).
 */
export function parseInboundShare(search: string): InboundShare | null {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  } catch {
    return null;
  }
  const title = cleanText(q.get('title') ?? '', 120);
  const text = cleanText(q.get('text') ?? '', 2000);
  const rawUrl = (q.get('url') ?? '').trim().slice(0, 2000);
  const url = rawUrl && isSafeExternalUrl(rawUrl) ? rawUrl : '';
  if (!title && !text && !url) return null;
  return { title, text, url };
}

/** Boot-time: stash inbound share params and clean the URL. */
export function consumeInboundShare(): InboundShare | null {
  try {
    if (typeof window === 'undefined') return null;
    const parsed = parseInboundShare(window.location.search);
    if (!parsed) return null;
    sessionStorage.setItem(INBOUND_SHARE_KEY, JSON.stringify({ ...parsed, at: Date.now() }));
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    return parsed;
  } catch {
    return null;
  }
}

/** Read-once (≤10 min old) inbound share for the Card Studio. */
export function takeInboundShare(): InboundShare | null {
  try {
    const raw = sessionStorage.getItem(INBOUND_SHARE_KEY);
    sessionStorage.removeItem(INBOUND_SHARE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { title?: unknown; text?: unknown; url?: unknown; at?: unknown };
    if (typeof v.at !== 'number' || Date.now() - v.at > 10 * 60_000) return null;
    const title = cleanText(typeof v.title === 'string' ? v.title : '', 120);
    const text = cleanText(typeof v.text === 'string' ? v.text : '', 2000);
    const url = typeof v.url === 'string' && isSafeExternalUrl(v.url) ? v.url.slice(0, 2000) : '';
    if (!title && !text && !url) return null;
    return { title, text, url };
  } catch {
    return null;
  }
}

/* ---------------- connectivity ---------------- */

/** Live online/offline signal for the layout banner. */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
