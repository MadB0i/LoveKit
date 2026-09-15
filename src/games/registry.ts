/**
 * games/registry.ts — the plug-in point for couple games.
 *
 * To add a game (contributors welcome!):
 *  1. Create `src/games/<my-game>.ts` exporting questions + pure scoring fns.
 *  2. Create `src/pages/games/<MyGame>.tsx` for the UI.
 *  3. Register one entry below + one route in `src/App.tsx`.
 * No other file needs to change.
 */

export interface GameDef {
  id: string;
  title: string;
  tagline: string;
  description: string;
  route: string;
  players: string;
  duration: string;
  emoji: string;
  howTo: string[];
}

export const GAMES: GameDef[] = [
  {
    id: 'know-me',
    title: 'How Well Do You Know Me?',
    tagline: 'Answer separately, reveal together.',
    description:
      'Each of you answers 5 questions about yourself, then guesses the other’s answers. Compare, laugh, learn.',
    route: '/games/know-me',
    players: '2 players · pass-and-play',
    duration: '≈ 10 min',
    emoji: '🧠',
    howTo: [
      'Player 1 answers all 5 questions about themselves.',
      'Pass the phone — Player 2 guesses Player 1’s answers.',
      'Swap roles, then reveal and count matches.',
    ],
  },
  {
    id: 'who-said-it',
    title: 'Who Said It?',
    tagline: 'ME / YOU — guess the author.',
    description:
      'One of you writes little truths, habits and hot takes. The other guesses who each one describes.',
    route: '/games/who-said-it',
    players: '2 players · pass-and-play',
    duration: '≈ 8 min',
    emoji: '🫣',
    howTo: [
      'The Writer adds 5+ statements (e.g. “Falls asleep during movies”).',
      'Hand the phone over — the Guesser taps ME or YOU for each.',
      'Reveal the score. Defend your honour.',
    ],
  },
  {
    id: 'this-or-that',
    title: 'This or That — Couple Edition',
    tagline: 'Beach or mountains? Pick fast.',
    description:
      'Twelve rapid-fire dilemmas. Answer separately, then see where your tastes overlap — and where date-night negotiations begin.',
    route: '/games/this-or-that',
    players: '2 players · pass-and-play',
    duration: '≈ 5 min',
    emoji: '⚖️',
    howTo: [
      'Player 1 picks one side of each pair (no overthinking!).',
      'Player 2 does the same without peeking.',
      'Reveal your overlap — matches are date ideas in disguise.',
    ],
  },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
