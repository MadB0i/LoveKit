/**
 * ai.ts — "AI, but different." The assistant helps real people express
 * themselves; it never roleplays as a partner.
 *
 * Architecture (swappable providers):
 * - `WritingProvider` — any backend implementing `transform()`.
 * - `LocalWritingProvider` — always available, fully offline, rule-based
 *   stylistic help (shorter / warmer / playful) over the USER's own words.
 * - `CustomEndpointProvider` — optional bring-your-own endpoint configured in
 *   the UI. API keys live only in the user's browser (localStorage), never in
 *   the codebase, and photos are never sent — text only, user-confirmed.
 *
 * Hard rules enforced in the UI copy AND the default system prompt:
 * no romantic-partner roleplay, no "true love" verdicts, no manipulative
 * advice, encourage repair and listening.
 */

import { cleanText } from './sanitize';

export type WritingTone = 'shorter' | 'warmer' | 'playful' | 'calmer' | 'formal';

export interface TransformRequest {
  text: string;
  tone: WritingTone;
  context?: string; // e.g. 'apology' | 'good-morning' | 'thanks'
}

export interface WritingProvider {
  id: string;
  label: string;
  transform(req: TransformRequest): Promise<string>;
}

/** Shortens without losing the user's meaning — extractive, honest. */
function makeShorter(text: string): string {
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 2) {
    // Fall back to trimming filler openers.
    return text
      .replace(/^(so,? |well,? |anyway,? |like,? )/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const scored = sentences.map((s) => ({
    s,
    score:
      (/(love|thank|sorry|proud|miss|grateful|mean|promise|always|remember)/i.test(s) ? 3 : 0) +
      (/\b(you|we|us)\b/i.test(s) ? 1 : 0) -
      (/^(anyway|so|like)\b/i.test(s) ? 2 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const keep = new Set(scored.slice(0, 2).map((x) => x.s));
  return sentences.filter((s) => keep.has(s)).join(' ');
}

function soften(text: string, warmth: string[]): string {
  let out = text.trim();
  if (!/[.!?…]$/.test(out)) out += '.';
  const closer = warmth[Math.floor(Math.random() * warmth.length)];
  // Don't stack closers if the user already wrote one.
  if (/(love you|yours|❤|💛|warmly)\s*[.!?…]?\s*$/i.test(out)) return out;
  return `${out} ${closer}`;
}

export class LocalWritingProvider implements WritingProvider {
  id = 'local';
  label = 'LoveKit local helper (offline)';

  async transform(req: TransformRequest): Promise<string> {
    const text = cleanText(req.text, 2000);
    if (!text) throw new Error('Write a rough draft first — even one messy sentence is enough.');
    switch (req.tone) {
      case 'shorter':
        return makeShorter(text);
      case 'warmer':
        return soften(text, ['Love you. ❤️', 'Thank you for being you. ❤️', 'Yours, always. ❤️']);
      case 'playful':
        return soften(text, ['P.S. You owe me a hug. 😄', 'Certified cutie behaviour. 😄', 'No take-backs! 😄']);
      case 'calmer':
        return makeShorter(text.replace(/!+/g, '.').replace(/\b(never|always)\b/gi, (m) => m.toLowerCase()));
      case 'formal':
        return makeShorter(
          text
            .replace(/\bgonna\b/gi, 'going to')
            .replace(/\bwanna\b/gi, 'want to')
            .replace(/!+/g, '.'),
        );
      default:
        return text;
    }
  }
}

/**
 * Optional BYO endpoint. The user pastes an OpenAI-compatible chat endpoint +
 * key in the UI; both stay in localStorage. Text-only, explicit consent per
 * request, abortable.
 */
export class CustomEndpointProvider implements WritingProvider {
  id = 'custom';
  label = 'Custom endpoint (BYO key)';
  constructor(
    private endpoint: string,
    private apiKey: string,
    private model = 'gpt-4o-mini',
  ) {}

  async transform(req: TransformRequest, signal?: AbortSignal): Promise<string> {
    if (!/^https:\/\//.test(this.endpoint)) throw new Error('Endpoint must be an https:// URL.');
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Tone: ${req.tone}. Context: ${req.context ?? 'note'}\n\nDraft:\n${req.text}` },
          ],
          max_tokens: 300,
        }),
      });
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new Error(
        offline
          ? 'You look offline — the custom helper needs internet. Turn off “Use it” above and the offline helper takes over.'
          : 'Could not reach the helper service. Check the endpoint URL and your connection.',
      );
    }
    if (!res.ok) throw new Error(`Helper service replied ${res.status}. Check your endpoint and key.`);
    // Read as text with a hard cap BEFORE parsing: a malicious or broken
    // endpoint must not be able to blow up memory with a giant body.
    const raw = (await res.text()).slice(0, 50_000);
    let json: { choices?: { message?: { content?: string } }[] };
    try {
      json = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    } catch {
      throw new Error('The helper replied with something unreadable. Check your endpoint.');
    }
    const out = cleanText(json.choices?.[0]?.message?.content ?? '', 2000);
    if (!out) throw new Error('The helper returned nothing. Try again.');
    return out;
  }
}

export const SYSTEM_PROMPT = [
  'You help one real person write a sincere message to their real partner.',
  'NEVER roleplay as the partner, girlfriend, boyfriend, or lover. Never say "I love you" as yourself.',
  'Never claim to know whether two people are true love or compatible.',
  'Prefer the user\'s own details over generic romance. Keep their voice.',
  'Encourage honesty, repair and listening. No manipulation, guilt-tripping, or love-bombing scripts.',
  'Keep it under 120 words unless asked otherwise.',
].join(' ');

/* ---------------- Guided apology composer ---------------- */

export const APOLOGY_QUESTIONS = [
  { id: 'what', label: 'What happened, in plain words?', hint: 'One or two sentences. No excuses yet.' },
  { id: 'impact', label: 'How do you think it felt for them?', hint: 'Show you actually pictured their side.' },
  { id: 'own', label: 'What part is yours to own?', hint: '“I” statements. Not “sorry you felt…”.' },
  { id: 'change', label: 'What will you do differently?', hint: 'One concrete, checkable thing.' },
] as const;

export interface ApologyAnswers {
  what: string;
  impact: string;
  own: string;
  change: string;
}

/** Compose a sincere apology FROM the user's answers — their words, structured. */
export function buildApology(toName: string, fromName: string, a: ApologyAnswers): string {
  const to = cleanText(toName, 60) || 'love';
  const parts = [
    `${to}, I've been thinking about what happened — ${cleanText(a.what, 500)}`,
    `I can see how that ${cleanText(a.impact, 500) || 'hurt you, and I hate that I caused it'}.`,
    `No excuses: ${cleanText(a.own, 500) || "I was wrong, and I'm sorry"}.`,
    `${cleanText(a.change, 500) ? `Here's what I'll do differently: ${cleanText(a.change, 500)}.` : 'I want to make this right.'}`,
    `You matter more to me than my pride. — ${cleanText(fromName, 60) || 'me'}`,
  ];
  return parts.join(' ');
}

export const DISCUSSION_STARTERS: string[] = [
  'What is a small thing I did lately that made you feel loved?',
  'What does a perfect ordinary Sunday look like for us?',
  'What is something you have been carrying that I could help lighten?',
  'What is a dream you rarely say out loud?',
  'When do you feel most like yourself around me?',
  'What is one tradition you want us to start?',
  'What is the kindest thing anyone has ever done for you?',
  'What would you do with a surprise free weekend together?',
  'What does your ideal date night look like — set the scene for me?',
  'What is one small thing that makes you feel wanted?',
  'When did you feel closest to me lately, and what were we doing?',
];

export function pickStarters(count: number, seed = Date.now()): string[] {
  const pool = [...DISCUSSION_STARTERS];
  // Deterministic-ish shuffle so tests can pin a seed.
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}
