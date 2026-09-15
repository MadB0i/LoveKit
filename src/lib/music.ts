/**
 * music.ts — an optional tiny music-box loop, synthesized with WebAudio.
 * No audio files, no network, no autoplay (starts only on user tap, which
 * also satisfies browser autoplay policies). Off by default.
 */

let ctx: AudioContext | null = null;
let timer: number | null = null;

// A gentle music-box waltz (frequencies, Hz). C major pentatonic-ish lullaby.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function pluck(ac: AudioContext, freq: number, when: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.12, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
  osc.connect(gain).connect(ac.destination);
  osc.start(when);
  osc.stop(when + 1.2);
}

export function startLullaby(): void {
  if (typeof window === 'undefined') return;
  const ac = ensureCtx();
  stopLullaby();
  let step = 0;
  const tick = () => {
    const t = ac.currentTime + 0.05;
    pluck(ac, NOTES[step % NOTES.length], t);
    if (step % 2 === 0) pluck(ac, NOTES[(step + 4) % NOTES.length] / 2, t);
    step++;
  };
  tick();
  timer = window.setInterval(tick, 620);
}

export function stopLullaby(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export function isLullabyPlaying(): boolean {
  return timer !== null;
}
