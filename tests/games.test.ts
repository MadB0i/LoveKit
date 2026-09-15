import { describe, expect, it } from 'vitest';
import { KNOW_ME_QUESTIONS, knowMeVerdict, normalizeAnswer, scoreKnowMe } from '../src/games/knowMe';
import { createStatement, scoreWhoSaidIt, whoSaidVerdict } from '../src/games/whoSaidIt';
import { THIS_OR_THAT_PAIRS, overlapLabel, recordPick, scoreThisOrThat } from '../src/games/thisOrThat';

describe('know-me', () => {
  it('matches forgivingly (case, punctuation, substrings)', () => {
    expect(normalizeAnswer('  The BEACH!! ')).toBe('the beach');
    const ids = ['comfort-food'];
    expect(scoreKnowMe({ 'comfort-food': 'Maggi at 2am' }, { 'comfort-food': 'maggi' }, ids).matches).toBe(1);
    expect(scoreKnowMe({ 'comfort-food': 'Pizza' }, { 'comfort-food': 'Pasta' }, ids).matches).toBe(0);
    expect(scoreKnowMe({}, { 'comfort-food': 'x' }, ids).matches).toBe(0);
  });

  it('verdicts scale with score', () => {
    expect(knowMeVerdict(5, 5)).toContain('mind-readers');
    expect(knowMeVerdict(0, 5)).toContain('new things');
    expect(knowMeVerdict(0, 0)).toBeTruthy();
  });

  it('ships a solid question bank', () => {
    expect(KNOW_ME_QUESTIONS.length).toBeGreaterThanOrEqual(10);
  });
});

describe('who-said-it', () => {
  it('creates and scores statements', () => {
    const a = createStatement('Falls asleep during movies', 'me');
    const b = createStatement('  ', 'you');
    expect(b).toBeNull();
    expect(a).not.toBeNull();
    if (!a) return;
    expect(scoreWhoSaidIt([a], { [a.id]: 'me' })).toEqual({ correct: 1, total: 1 });
    expect(scoreWhoSaidIt([a], { [a.id]: 'you' }).correct).toBe(0);
    expect(whoSaidVerdict(0, 0)).toContain('first');
  });
});

describe('this-or-that', () => {
  it('counts overlap without claiming compatibility science', () => {
    const ids = THIS_OR_THAT_PAIRS.map((p) => p.id);
    let a: Record<string, string> = {};
    let b: Record<string, string> = {};
    for (const p of THIS_OR_THAT_PAIRS) {
      a = recordPick(a, p.id, p.a);
      b = recordPick(b, p.id, p.a);
    }
    const full = scoreThisOrThat(a, b, ids);
    expect(full.matches).toBe(ids.length);
    b = recordPick(b, ids[0], 'something else');
    expect(scoreThisOrThat(a, b, ids).matches).toBe(ids.length - 1);
    expect(overlapLabel(1, 1)).toBeTruthy();
    // The label must never sound like a scientific verdict.
    expect(overlapLabel(0, 12).toLowerCase()).not.toContain('compatib');
  });
});
