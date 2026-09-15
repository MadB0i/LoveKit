/**
 * themes.ts — the LoveKit design system in data form.
 *
 * Sophisticated, warm, premium — deliberately NOT all-pink. Contributors add
 * a theme by appending one object here (see CONTRIBUTING.md). Every theme
 * must define both a light-feeling `paper` card and work on dark page bg.
 */

export interface CardTheme {
  id: string;
  name: string;
  blurb: string;
  /** Card background gradient stops */
  bg: [string, string];
  /** Card ink (main text) */
  ink: string;
  /** Muted text on card */
  muted: string;
  /** Accent (names, dividers, seals) */
  accent: string;
  /** Decorative soft glow / pattern tint */
  glow: string;
  font: 'serif' | 'sans' | 'script';
  pattern: 'hearts' | 'stars' | 'petals' | 'waves' | 'none';
}

export const THEMES: CardTheme[] = [
  {
    id: 'ember',
    name: 'Ember Night',
    blurb: 'Deep plum & candlelight gold',
    bg: ['#2b1a22', '#4a2436'],
    ink: '#f8ecdd',
    muted: '#d9bfae',
    accent: '#e8b04b',
    glow: '#e8b04b33',
    font: 'serif',
    pattern: 'stars',
  },
  {
    id: 'cream-letter',
    name: 'Cream Letter',
    blurb: 'Timeless paper & ink',
    bg: ['#faf5ea', '#f0e4cf'],
    ink: '#3a2a20',
    muted: '#8a7364',
    accent: '#b3543f',
    glow: '#b3543f22',
    font: 'serif',
    pattern: 'none',
  },
  {
    id: 'rosewood',
    name: 'Rosewood',
    blurb: 'Muted rose, grown-up romance',
    bg: ['#3d2129', '#6e3542'],
    ink: '#fae9e4',
    muted: '#d8a89e',
    accent: '#f0a6a0',
    glow: '#f0a6a022',
    font: 'script',
    pattern: 'petals',
  },
  {
    id: 'midnight',
    name: 'Midnight Postcard',
    blurb: 'Ink blue & moonlight',
    bg: ['#141b2e', '#26324f'],
    ink: '#e9eefb',
    muted: '#a9b6d3',
    accent: '#9fc2ff',
    glow: '#9fc2ff2e',
    font: 'sans',
    pattern: 'stars',
  },
  {
    id: 'sage',
    name: 'Sage Morning',
    blurb: 'Calm green, soft sunrise',
    bg: ['#f2f4e8', '#dfe6cf'],
    ink: '#2e3a2a',
    muted: '#6f7d68',
    accent: '#c2703d',
    glow: '#c2703d26',
    font: 'serif',
    pattern: 'waves',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    blurb: 'Sun-baked clay & cream',
    bg: ['#7c3b2a', '#b2603c'],
    ink: '#fdf1e3',
    muted: '#f0c9a8',
    accent: '#ffd9a0',
    glow: '#ffd9a033',
    font: 'serif',
    pattern: 'waves',
  },
  {
    id: 'dusk',
    name: 'Lavender Dusk',
    blurb: 'Quiet violet evening',
    bg: ['#241f3d', '#4b3a6e'],
    ink: '#efe8fb',
    muted: '#bcaed8',
    accent: '#e3b7ff',
    glow: '#e3b7ff30',
    font: 'script',
    pattern: 'hearts',
  },
  {
    id: 'ocean-note',
    name: 'Ocean Note',
    blurb: 'Deep teal & seafoam',
    bg: ['#10333a', '#1e5a5e'],
    ink: '#eafaf3',
    muted: '#a9d3c6',
    accent: '#ffd166',
    glow: '#ffd1662e',
    font: 'sans',
    pattern: 'waves',
  },
];

export function getTheme(id: string): CardTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const FONT_STACK: Record<CardTheme['font'], string> = {
  serif: 'Georgia, "Times New Roman", "Fraunces", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  script: '"Segoe Script", "Brush Script MT", Georgia, serif',
};
