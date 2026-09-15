import { useEffect, useState } from 'react';

/** Live reduced-motion signal: OS setting OR in-app toggle. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      (typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion')) ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const obs = new MutationObserver(() =>
      setReduced(document.documentElement.classList.contains('reduce-motion') || mq.matches),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const onChange = () => setReduced(document.documentElement.classList.contains('reduce-motion') || mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => {
      obs.disconnect();
      mq.removeEventListener?.('change', onChange);
    };
  }, []);
  return reduced;
}

/** Deterministic pseudo-random (stable across renders for the same seed). */
function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function FloatEmojis({ emoji = '❤️', count = 14 }: { emoji?: string; count?: number }): React.ReactElement | null {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const r = rand(emoji.length * 97 + count);
  const items = Array.from({ length: count }, (_, i) => ({
    left: `${r() * 92}%`,
    fontSize: `${0.9 + r() * 1.3}rem`,
    duration: `${6 + r() * 7}s`,
    delay: `${-r() * 10}s`,
    ch: i % 5 === 4 ? '✨' : emoji,
  }));
  return (
    <div className="motif-layer float-layer" aria-hidden="true">
      {items.map((it, i) => (
        <span key={i} style={{ left: it.left, fontSize: it.fontSize, animationDuration: it.duration, animationDelay: it.delay }}>
          {it.ch}
        </span>
      ))}
    </div>
  );
}

const CONFETTI_COLORS = ['#b3543f', '#e8b04b', '#7fae86', '#9fc2ff', '#e3a0b6', '#ffd166'];

export function Confetti({ count = 36 }: { count?: number }): React.ReactElement | null {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const r = rand(42);
  const items = Array.from({ length: count }, (_, i) => ({
    left: `${r() * 98}%`,
    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    duration: `${3.5 + r() * 4}s`,
    delay: `${-r() * 6}s`,
    rotate: `${r() * 360}deg`,
  }));
  return (
    <div className="motif-layer confetti-layer" aria-hidden="true">
      {items.map((it, i) => (
        <i key={i} style={{ left: it.left, background: it.background, animationDuration: it.duration, animationDelay: it.delay }} />
      ))}
    </div>
  );
}

export function Sparkles({ count = 18 }: { count?: number }): React.ReactElement | null {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const r = rand(7);
  const items = Array.from({ length: count }, () => ({
    left: `${4 + r() * 90}%`,
    top: `${4 + r() * 90}%`,
    fontSize: `${0.7 + r() * 1}rem`,
    delay: `${-r() * 2.4}s`,
  }));
  return (
    <div className="motif-layer sparkle-layer" aria-hidden="true">
      {items.map((it, i) => (
        <i key={i} style={{ left: it.left, top: it.top, fontSize: it.fontSize, animationDelay: it.delay }}>
          ✦
        </i>
      ))}
    </div>
  );
}

/** Typewriter that degrades to full text under reduced motion. */
export function useTypewriter(text: string, cps = 28): string {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) {
      setN(text.length);
      return;
    }
    setN(0);
    if (!text) return;
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, cps, reduced]);
  return text.slice(0, n);
}
