/**
 * stickerArt.ts — the Sweethearts starter pack: 12 original LoveKit SVG
 * stickers (hand-drawn in code, zero copyright risk). `url` feeds the
 * canvas renderer; `source` lets tests prove there's no script/active
 * content hiding in the art.
 *
 * NOTE: Vite inlines these (<4 KB) as data: URLs straight into the bundle —
 * that is intentional and safe: data-URL SVG in <img>/canvas cannot run
 * scripts, stays same-origin-clean for toDataURL, and ships inside the
 * offline-cached app shell. Keep each file small and self-contained
 * (no external refs) so this keeps working.
 */
import birdsKissUrl from './sticker-art/birds-kiss.svg?url';
import birdsKissSrc from './sticker-art/birds-kiss.svg?raw';
import envelopeUrl from './sticker-art/envelope.svg?url';
import envelopeSrc from './sticker-art/envelope.svg?raw';
import heartEyesUrl from './sticker-art/heart-eyes.svg?url';
import heartEyesSrc from './sticker-art/heart-eyes.svg?raw';
import hugHeartsUrl from './sticker-art/hug-hearts.svg?url';
import hugHeartsSrc from './sticker-art/hug-hearts.svg?raw';
import infinityUrl from './sticker-art/infinity.svg?url';
import infinitySrc from './sticker-art/infinity.svg?raw';
import lipsUrl from './sticker-art/lips.svg?url';
import lipsSrc from './sticker-art/lips.svg?raw';
import lockkeyUrl from './sticker-art/lockkey.svg?url';
import lockkeySrc from './sticker-art/lockkey.svg?raw';
import loveyouUrl from './sticker-art/loveyou.svg?url';
import loveyouSrc from './sticker-art/loveyou.svg?raw';
import moonstarsUrl from './sticker-art/moonstars.svg?url';
import moonstarsSrc from './sticker-art/moonstars.svg?raw';
import roseUrl from './sticker-art/rose.svg?url';
import roseSrc from './sticker-art/rose.svg?raw';
import sunkissUrl from './sticker-art/sunkiss.svg?url';
import sunkissSrc from './sticker-art/sunkiss.svg?raw';
import teddyUrl from './sticker-art/teddy.svg?url';
import teddySrc from './sticker-art/teddy.svg?raw';

export interface StickerArt {
  id: string;
  name: string;
  url: string;
  source: string;
}

export const STICKER_ART: StickerArt[] = [
  { id: 'lips', name: 'Kiss mark 💋', url: lipsUrl, source: lipsSrc },
  { id: 'birds-kiss', name: 'Lovebirds', url: birdsKissUrl, source: birdsKissSrc },
  { id: 'hug-hearts', name: 'Heart hug', url: hugHeartsUrl, source: hugHeartsSrc },
  { id: 'heart-eyes', name: 'Heart eyes', url: heartEyesUrl, source: heartEyesSrc },
  { id: 'loveyou', name: 'Love you', url: loveyouUrl, source: loveyouSrc },
  { id: 'rose', name: 'A rose', url: roseUrl, source: roseSrc },
  { id: 'lockkey', name: 'Locked hearts', url: lockkeyUrl, source: lockkeySrc },
  { id: 'moonstars', name: 'Moonlit', url: moonstarsUrl, source: moonstarsSrc },
  { id: 'teddy', name: 'Teddy hug', url: teddyUrl, source: teddySrc },
  { id: 'infinity', name: 'Forever ♾️', url: infinityUrl, source: infinitySrc },
  { id: 'envelope', name: 'Love letter', url: envelopeUrl, source: envelopeSrc },
  { id: 'sunkiss', name: 'Sunny kiss', url: sunkissUrl, source: sunkissSrc },
];
