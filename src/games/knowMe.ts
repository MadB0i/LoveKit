/**
 * games/knowMe.ts — "How Well Do You Know Me?" content + pure scoring.
 * All functions are side-effect free so they are trivially testable.
 */
import { cleanText } from '../lib/sanitize';

export interface KnowQuestion {
  id: string;
  prompt: string;
  example: string;
}

export const KNOW_ME_QUESTIONS: KnowQuestion[] = [
  { id: 'comfort-food', prompt: "What's my ultimate comfort food?", example: 'Maggi at 2am' },
  { id: 'happy', prompt: 'What is one small thing that always makes me happy?', example: 'Rain on windows' },
  { id: 'destination', prompt: 'What is my dream destination?', example: 'Kyoto in autumn' },
  { id: 'fear', prompt: "What's something I'm quietly afraid of?", example: 'Being forgotten' },
  { id: 'memory', prompt: 'What is my favourite memory of us?', example: 'That rainy auto ride' },
  { id: 'morning', prompt: 'Am I a morning person or a night owl — and why?', example: 'Night owl, obviously' },
  { id: 'gift', prompt: 'What is the best gift I ever received?', example: 'The mixtape' },
  { id: 'song', prompt: 'What song instantly fixes my mood?', example: 'That one chorus' },
  { id: 'weekend', prompt: 'Describe my perfect weekend.', example: 'No plans + pancakes' },
  { id: 'proud', prompt: 'What am I most proud of?', example: 'Learning to swim at 24' },
  { id: 'pet-peeve', prompt: 'What is my biggest pet peeve?', example: 'Loud chewing' },
  { id: 'love-lang', prompt: 'How do I feel most loved? (words, hugs, help, gifts, time?)', example: 'Long calls' },
];

/** Normalise for forgiving comparison: case, punctuation, extra spaces. */
export function normalizeAnswer(s: string): string {
  return cleanText(s, 300)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare self-answers vs guesses. A match counts when normalised strings are
 * equal OR one contains the other (min 4 chars) — generous, because couples
 * describe the same thing differently ("beach" vs "the beach!!").
 */
export function scoreKnowMe(
  selfAnswers: Record<string, string>,
  guesses: Record<string, string>,
  questionIds: string[],
): { matches: number; total: number; perQuestion: { id: string; match: boolean }[] } {
  const perQuestion = questionIds.map((id) => {
    const a = normalizeAnswer(selfAnswers[id] ?? '');
    const g = normalizeAnswer(guesses[id] ?? '');
    const match =
      a.length > 0 && g.length > 0 && (a === g || (a.length >= 4 && g.includes(a)) || (g.length >= 4 && a.includes(g)));
    return { id, match };
  });
  return { matches: perQuestion.filter((p) => p.match).length, total: questionIds.length, perQuestion };
}

export function knowMeVerdict(matches: number, total: number): string {
  const r = total === 0 ? 0 : matches / total;
  if (r >= 0.8) return 'Certified mind-readers. Suspiciously in sync. 🥰';
  if (r >= 0.6) return 'Properly tuned in. A few mysteries left — good. 💛';
  if (r >= 0.4) return 'Solid! With excellent room for late-night conversations. ✨';
  return 'Beautiful — you just discovered new things to ask each other. 🫶';
}
