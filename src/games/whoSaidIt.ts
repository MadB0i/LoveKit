/**
 * games/whoSaidIt.ts — "Who Said It?" content + pure scoring.
 */
import { cleanText } from '../lib/sanitize';
import { uid } from '../lib/store';

export type Person = 'me' | 'you';

export interface WhoStatement {
  id: string;
  text: string;
  author: Person;
}

export const WHO_SAID_IDEAS: string[] = [
  'Falls asleep during movies',
  'Cries at dog videos',
  'Steals the blanket every night',
  'Plans trips that never happen',
  'Says “one more episode” at 1am',
  'Remembers every anniversary except this one',
  'Sings in the shower like it’s a stadium',
  'Eats fries before the burger arrives',
  'Texts back three days later',
  'Always knows where the snacks are',
  'Gets competitive over board games',
  'Forgets why they walked into a room',
];

export function createStatement(text: string, author: Person): WhoStatement | null {
  const t = cleanText(text, 140);
  if (!t) return null;
  if (author !== 'me' && author !== 'you') return null;
  return { id: uid('ws'), text: t, author };
}

/**
 * Frame-of-reference map for the guess buttons. Statement authors are stored
 * in the WRITER's frame ('me' = writer, 'you' = guesser), but the guesser taps
 * "ME" (themselves) or "YOU" (the writer) — the opposite assignment.
 * Centralised (and tested) here because getting it backwards silently inverts
 * every score while the UI still looks right.
 */
export function guesserVote(aboutGuesser: boolean): Person {
  return aboutGuesser ? 'you' : 'me';
}

export function scoreWhoSaidIt(
  statements: WhoStatement[],
  guesses: Record<string, Person>,
): { correct: number; total: number } {
  let correct = 0;
  for (const s of statements) {
    if (guesses[s.id] === s.author) correct++;
  }
  return { correct, total: statements.length };
}

export function whoSaidVerdict(correct: number, total: number): string {
  if (total === 0) return 'Add some statements first!';
  const r = correct / total;
  if (r === 1) return 'Flawless. Are you two sharing a brain? 🧠❤️';
  if (r >= 0.7) return 'You really do pay attention. Cute. 🥰';
  if (r >= 0.4) return 'Half-right — the debates will be fun. 😄';
  return 'Delightfully wrong. Story time! 🫣';
}
