/**
 * types.ts — shared domain models. Everything is plain JSON so it can be
 * stored in localStorage and encoded into share links.
 */

export type CardCategory =
  | 'good-morning'
  | 'good-night'
  | 'miss-you'
  | 'sorry'
  | 'thank-you'
  | 'appreciation'
  | 'birthday'
  | 'anniversary'
  | 'valentines'
  | 'long-distance'
  | 'feeling-low'
  | 'proposal'
  | 'date-night'
  | 'just-because'
  | 'custom';

export type CardAnimation = 'hearts' | 'confetti' | 'sparkles' | 'typewriter' | 'reveal' | 'none';
export type CardEffect = 'hearts' | 'float-emoji' | 'confetti' | 'sparkles';

export interface LoveCard {
  id: string;
  category: CardCategory;
  toName: string;
  fromName: string;
  message: string;
  themeId: string;
  effects: CardEffect[];
  animation: CardAnimation;
  emoji: string;
  photo?: string;
  dateLabel?: string;
  music?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type StickerElementKind = 'image' | 'text' | 'emoji' | 'heart';

export interface StickerElement {
  id: string;
  kind: StickerElementKind;
  /** Center position in 512-space */
  x: number;
  y: number;
  scale: number;
  rotation: number; // degrees
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  outline?: string;
  align?: 'left' | 'center' | 'right';
  image?: string; // data-URL
  size?: number; // base size in px (512-space) for image/emoji/heart
  flipX?: boolean;
}

export interface Sticker {
  id: string;
  name: string;
  elements: StickerElement[];
  backgroundTransparent: boolean;
  borderWidth: number;
  borderColor: string;
  createdAt: number;
  updatedAt: number;
}

export interface StickerPack {
  id: string;
  name: string;
  author: string;
  description: string;
  iconStickerId?: string;
  stickerIds: string[];
  createdAt: number;
}

export interface Memory {
  id: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  photo?: string;
  /** Link-sized copy of `photo`, generated on save for share URLs. */
  thumb?: string;
  location?: string;
  tags: string[];
  createdAt: number;
}

export interface Coupon {
  id: string;
  title: string;
  description: string;
  designId: string;
  expiry?: string; // ISO date or ''
  redeemed: boolean;
  code: string; // short human code, e.g. HUG-4F2K
  createdAt: number;
}

export interface TimeCapsule {
  id: string;
  title: string;
  /** Ciphertext envelope (see capsules.ts). Locked capsules never expose `message`. */
  sealed: string;
  unlockAt: number;
  hint?: string;
  hasPassphrase: boolean;
  createdAt: number;
}

export interface KnowMeSession {
  id: string;
  questionIds: string[];
  answersA: Record<string, string>;
  answersB: Record<string, string>;
  revealed: boolean;
  createdAt: number;
}

export interface WhoSaidItSession {
  id: string;
  statements: { id: string; text: string; author: 'me' | 'you' }[];
  guesses: Record<string, 'me' | 'you'>;
  createdAt: number;
}

export interface ThisOrThatSession {
  id: string;
  pairIds: string[];
  picksA: Record<string, string>;
  picksB: Record<string, string>;
  createdAt: number;
}
