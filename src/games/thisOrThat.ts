/**
 * games/thisOrThat.ts — "This or That" pairs + overlap scoring.
 *
 * NOTE (product honesty): the result is framed as playful "taste overlap",
 * never as a scientific compatibility verdict. LoveKit does not do
 * love-compatibility scores.
 */
import { cleanText } from '../lib/sanitize';

export interface ThisThatPair {
  id: string;
  a: string;
  b: string;
}

export const THIS_OR_THAT_PAIRS: ThisThatPair[] = [
  { id: 'scenery', a: '🏖️ Beach', b: '⛰️ Mountains' },
  { id: 'evening', a: '🎬 Movie night', b: '🍽️ Dinner date' },
  { id: 'contact', a: '📞 Call', b: '💬 Text' },
  { id: 'sky', a: '🌅 Sunrise', b: '🌇 Sunset' },
  { id: 'affection', a: '🫂 Hug', b: '💋 Kiss' },
  { id: 'weekend', a: '🏠 Stay in', b: '🧭 Go out' },
  { id: 'food', a: '🍕 Savoury', b: '🍰 Sweet' },
  { id: 'trip', a: '🗺️ Planned itinerary', b: '🎲 Spontaneous' },
  { id: 'music', a: '🎧 Same playlist', b: '🎶 Your own vibe' },
  { id: 'season', a: '🌧️ Rainy days', b: '☀️ Sunny days' },
  { id: 'party', a: '🎉 Big party', b: '🕯️ Cosy two-person night' },
  { id: 'gift', a: '🎁 Surprise gift', b: '💌 Love letter' },
  { id: 'datenight', a: '🕯️ Candlelight dinner', b: '✨ Stargazing picnic' },
  { id: 'slow', a: '💃 Kitchen slow dance', b: '🚗 Midnight long drive' },
  { id: 'dress', a: '👗 Dress up for each other', b: '🛋️ Blanket fort + takeout' },
  { id: 'romance', a: '💋 A whispered plan', b: '💌 A handwritten note' },
];

export function recordPick(picks: Record<string, string>, pairId: string, side: string): Record<string, string> {
  return { ...picks, [pairId]: cleanText(side, 60) };
}

export function scoreThisOrThat(
  picksA: Record<string, string>,
  picksB: Record<string, string>,
  pairIds: string[],
): { matches: number; total: number; matchedIds: string[] } {
  const matchedIds = pairIds.filter((id) => picksA[id] && picksA[id] === picksB[id]);
  return { matches: matchedIds.length, total: pairIds.length, matchedIds };
}

export function overlapLabel(matches: number, total: number): string {
  const r = total === 0 ? 0 : matches / total;
  if (r >= 0.75) return 'Beautifully in sync — suspiciously good date planners. 💛';
  if (r >= 0.5) return 'Lovely overlap, with delicious differences to explore. ✨';
  if (r >= 0.25) return 'Opposites seasoning each other. Date-night negotiations await. 😄';
  return 'Two glorious individuals. Twice the date ideas. 🫶';
}
