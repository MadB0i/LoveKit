/**
 * templates.ts — community message starters, organised by category.
 *
 * Philosophy: templates are STARTING points, never finished products. The
 * editor always encourages editing ("make it yours"). Placeholders:
 * {{partner}} and {{sender}}. Contributors: add entries + a category in
 * `CARD_CATEGORIES` (see CONTRIBUTING.md).
 */

import type { CardCategory } from '../lib/types';
import { cleanText } from '../lib/sanitize';

export interface Category {
  id: CardCategory;
  label: string;
  emoji: string;
  hint: string;
}

export const CARD_CATEGORIES: Category[] = [
  { id: 'good-morning', label: 'Good Morning', emoji: '☀️', hint: 'Start their day softly' },
  { id: 'good-night', label: 'Good Night', emoji: '🌙', hint: 'Tuck them in with words' },
  { id: 'miss-you', label: 'I Miss You', emoji: '💭', hint: 'Bridge the distance' },
  { id: 'sorry', label: 'Sorry', emoji: '🥺', hint: 'Own it, repair it' },
  { id: 'thank-you', label: 'Thank You', emoji: '🙏', hint: 'Notice the little things' },
  { id: 'appreciation', label: 'Appreciation', emoji: '❤️', hint: 'Say what you see in them' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', hint: 'Celebrate their story' },
  { id: 'anniversary', label: 'Anniversary', emoji: '🥂', hint: 'Mark the miles together' },
  { id: 'valentines', label: "Valentine's Day", emoji: '💘', hint: 'Classic, minus the cliché' },
  { id: 'long-distance', label: 'Long Distance', emoji: '✈️', hint: 'Miles are just logistics' },
  { id: 'feeling-low', label: 'Feeling Low', emoji: '🫂', hint: 'Sit beside them in it' },
  { id: 'proposal', label: 'Proposal', emoji: '💍', hint: 'The biggest question' },
  { id: 'date-night', label: 'Date Night', emoji: '💋', hint: 'Set the mood, tastefully' },
  { id: 'just-because', label: 'Just Because', emoji: '✨', hint: 'No occasion needed' },
  { id: 'custom', label: 'Custom', emoji: '✍️', hint: 'Blank page, your words' },
];

export interface MessageTemplate {
  id: string;
  category: CardCategory;
  title: string;
  body: string;
}

export function categoryLabel(id: CardCategory): string {
  return CARD_CATEGORIES.find((c) => c.id === id)?.label ?? 'Custom';
}

/** Replace {{partner}} / {{sender}} placeholders. */
export function fillTemplate(body: string, partner: string, sender: string): string {
  const p = cleanText(partner, 60) || 'love';
  const s = cleanText(sender, 60) || '';
  return body.replace(/{{partner}}/g, p).replace(/{{sender}}/g, s).trim();
}

export const TEMPLATES: MessageTemplate[] = [
  {
    id: 'gm-1',
    category: 'good-morning',
    title: 'Slow sunrise',
    body: 'Good morning, {{partner}}. The day hasn’t even started and I’m already grateful it includes you. Go gently today — I’ll be cheering from here. ☀️',
  },
  {
    id: 'gm-2',
    category: 'good-morning',
    title: 'First thought',
    body: 'You were my first thought this morning, {{partner}}. Whatever today holds, I hope it treats you the way you treat everyone — kindly.',
  },
  {
    id: 'gn-1',
    category: 'good-night',
    title: 'Rest well',
    body: 'Good night, {{partner}}. Put the day down — you did enough. I’m proud of you, and I’ll be right here in the morning. 🌙',
  },
  {
    id: 'gn-2',
    category: 'good-night',
    title: 'Same sky',
    body: 'Sleep well, {{partner}}. Different pillows, same moon. Dream something good — I’ll ask about it tomorrow.',
  },
  {
    id: 'miss-1',
    category: 'miss-you',
    title: 'Ordinary missing',
    body: 'It’s the ordinary moments I miss most, {{partner}} — grocery runs, your laugh from the other room, doing nothing together. Counting down to all of it. ❤️',
  },
  {
    id: 'miss-2',
    category: 'miss-you',
    title: 'Evidence',
    body: '{{partner}}, evidence I miss you: I saved you the last bite, I saw our song and didn’t skip it, and I told a stranger you’d laugh at their dog. Come home soon.',
  },
  {
    id: 'sorry-1',
    category: 'sorry',
    title: 'Owning it',
    body: '{{partner}}, I was wrong, and I’m sorry. Not “sorry you’re upset” — sorry I did the thing that hurt you. You deserved better from me, and I want to make it right.',
  },
  {
    id: 'sorry-2',
    category: 'sorry',
    title: 'Repair note',
    body: 'I’ve been replaying it, {{partner}}, and I see your side now. I’m sorry. Tell me what repair looks like for you — I’m listening, properly this time. 🥺',
  },
  {
    id: 'thanks-1',
    category: 'thank-you',
    title: 'Noticed',
    body: 'Thank you, {{partner}} — for the small, invisible things: the refilled water, the remembered details, the way you make hard days lighter. I notice. All of it. 🙏',
  },
  {
    id: 'thanks-2',
    category: 'thank-you',
    title: 'Specific thanks',
    body: '{{partner}}, thank you for [that thing you did — write it here, specifically]. It mattered more than you know.',
  },
  {
    id: 'appr-1',
    category: 'appreciation',
    title: 'What I see',
    body: '{{partner}}, here’s what I see: someone who shows up, who cares loudly and quietly, who makes every room warmer. I’m lucky — and I don’t say it enough. ❤️',
  },
  {
    id: 'appr-2',
    category: 'appreciation',
    title: 'Proud of you',
    body: 'I’m so proud of you, {{partner}}. Not for anything huge — for the everyday courage of being you. Keep going. I see it all.',
  },
  {
    id: 'bday-1',
    category: 'birthday',
    title: 'Your day',
    body: 'Happy birthday, {{partner}}! 🎂 Today the world celebrates its excellent decision to include you. Wish first, cake second, me third — I’ll wait.',
  },
  {
    id: 'bday-2',
    category: 'birthday',
    title: 'Another chapter',
    body: 'Another year of you, {{partner}} — funnier, kinder, more yourself. I can’t wait to read this chapter with you. Happy birthday! 🎂',
  },
  {
    id: 'anni-1',
    category: 'anniversary',
    title: 'Miles together',
    body: 'Happy anniversary, {{partner}}. 🥂 Look how far “let’s get coffee” brought us. I’d choose this — choose you — in every version of the story.',
  },
  {
    id: 'anni-2',
    category: 'anniversary',
    title: 'Still my favourite',
    body: 'Years in, {{partner}}, and you’re still my favourite notification, my favourite plan, my favourite person. Happy anniversary. ❤️',
  },
  {
    id: 'val-1',
    category: 'valentines',
    title: 'No cliché',
    body: 'Skip the roses, {{partner}} — here’s the truth: you make Tuesday feel like an occasion. Happy Valentine’s Day to my favourite ordinary magic. 💘',
  },
  {
    id: 'ld-1',
    category: 'long-distance',
    title: 'Logistics',
    body: 'Miles are just logistics, {{partner}}. You’re in my mornings, my playlists, my “you’d love this” list. Same team, different time zones. ✈️❤️',
  },
  {
    id: 'ld-2',
    category: 'long-distance',
    title: 'Countdown',
    body: 'Every “good night” text is one closer to “good morning” in person, {{partner}}. Holding on tight across the miles. ✈️',
  },
  {
    id: 'low-1',
    category: 'feeling-low',
    title: 'Sitting with you',
    body: '{{partner}}, you don’t have to be okay today. I’m not going anywhere — I’ll sit in the grey with you until the colour comes back. 🫂',
  },
  {
    id: 'low-2',
    category: 'feeling-low',
    title: 'Heavy day',
    body: 'Heavy day? Lean on me, {{partner}}. Rest, cry, rage — whatever it needs. I’ve got the umbrella and the snacks. 🫂',
  },
  {
    id: 'prop-1',
    category: 'proposal',
    title: 'The question',
    body: '{{partner}}, every love story is beautiful, but I want ours to be my forever. Will you marry me? 💍',
  },
  {
    id: 'date-1',
    category: 'date-night',
    title: 'Phones on silent',
    body: 'Tonight, {{partner}}: phones on silent, candles on, and nowhere else to be. Just us, good food, and whatever the evening turns into. 💋',
  },
  {
    id: 'date-2',
    category: 'date-night',
    title: 'You, that outfit',
    body: 'Wear that thing I love, {{partner}}. I’ll handle dinner, the playlist, and staring at you like it’s our first date. 💋',
  },
  {
    id: 'date-3',
    category: 'date-night',
    title: 'Kitchen slow dance',
    body: 'No restaurant tonight, {{partner}}. Just bare feet, your head on my shoulder, and one song on repeat. The rest of the night is unwritten — your call. 💋',
  },
  {
    id: 'date-4',
    category: 'date-night',
    title: 'Stargazing plan',
    body: '{{partner}}, blanket, rooftop (or balcony, or the car roof — I’m flexible), and the sky. I’ll bring the snacks and the compliments. You bring yourself. ✨💋',
  },
  {
    id: 'date-5',
    category: 'date-night',
    title: 'Anticipation note',
    body: 'I’ve been thinking about tonight all day, {{partner}}. About your laugh, your hands, the way you look at me. Hurry home. 💋',
  },
  {
    id: 'date-6',
    category: 'date-night',
    title: 'Your pace',
    body: 'Tonight is whatever you want it to be, {{partner}} — wild or quiet, out or in. My only plan is you, and making sure you feel completely wanted. 💋',
  },
  {
    id: 'just-1',
    category: 'just-because',
    title: 'Tuesday love note',
    body: 'No occasion, {{partner}} — just a Tuesday and a thought: life is better with you in it. That’s the whole message. That’s enough. ✨',
  },
  {
    id: 'just-2',
    category: 'just-because',
    title: 'Reminder',
    body: 'Reminder, {{partner}}: you are loved, you are doing better than you think, and someone (me) thinks you’re wonderful. ✨',
  },
];
