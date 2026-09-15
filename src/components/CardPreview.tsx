import { useMemo } from 'react';
import type { LoveCard } from '../lib/types';
import { FONT_STACK, getTheme } from '../data/themes';
import { categoryLabel } from '../data/templates';
import { Confetti, FloatEmojis, Sparkles, useReducedMotion, useTypewriter } from './Effects';

/**
 * Animated love-card preview. All user content is rendered as text
 * (React-escaped) — never injected as HTML.
 */
export default function CardPreview({
  card,
  animate = true,
}: {
  card: LoveCard;
  animate?: boolean;
}): React.ReactElement {
  const theme = getTheme(card.themeId);
  const reduced = useReducedMotion();
  const typed = useTypewriter(card.animation === 'typewriter' && animate && !reduced ? card.message : '', 30);
  const message = card.animation === 'typewriter' && animate && !reduced ? typed : card.message;

  const layers = useMemo(() => {
    if (!animate || reduced) return null;
    return (
      <>
        {(card.effects.includes('hearts') || card.animation === 'hearts') && <FloatEmojis emoji="❤️" />}
        {card.effects.includes('float-emoji') && <FloatEmojis emoji={card.emoji || '✨'} />}
        {card.effects.includes('confetti') && <Confetti />}
        {card.effects.includes('sparkles') && <Sparkles />}
        {(card.animation === 'confetti' || card.animation === 'sparkles') && <Sparkles />}
      </>
    );
  }, [animate, reduced, card.effects, card.animation, card.emoji]);

  const font = FONT_STACK[theme.font];
  return (
    <div
      className={`lovecard ${card.animation === 'reveal' && animate && !reduced ? 'anim-reveal' : ''} ${card.animation === 'typewriter' ? 'typewriter' : ''}`}
      style={{ background: `linear-gradient(160deg, ${theme.bg[0]}, ${theme.bg[1]})`, color: theme.ink }}
      role="img"
      aria-label={`Love card for ${card.toName || 'your partner'} in category ${categoryLabel(card.category)}`}
    >
      {layers}
      <div className="lovecard-inner" style={{ fontFamily: font }}>
        <div className="eyebrow-lite" style={{ color: theme.muted }}>
          A NOTE FOR
        </div>
        <h3 className="to-name">{card.toName || 'My Love'}</h3>
        <div className="divider" style={{ color: theme.accent }}>
          ♥
        </div>
        {card.photo && <img className="photo" src={card.photo} alt="A photo you chose for this card" />}
        <p className="msg">{message || <span style={{ opacity: 0.6 }}>Your words will bloom here…</span>}</p>
        <div className="from" style={{ color: theme.accent }}>
          {card.fromName ? `— ${card.fromName}` : ''}
        </div>
        {card.dateLabel && <div className="datelabel">{card.dateLabel}</div>}
      </div>
      <div className="seal" aria-hidden="true">
        {card.emoji || '❤️'}
      </div>
      <div className="wordmark" style={{ color: theme.muted }}>
        made with ♥ in lovekit
      </div>
    </div>
  );
}
