/**
 * cardExport.ts — render a LoveCard to a shareable PNG (1080×1350, 4:5).
 * The on-screen preview is animated HTML; this painter reproduces the same
 * design on canvas so "Download" works everywhere with zero dependencies.
 */
import type { LoveCard } from './types';
import { getTheme, FONT_STACK } from '../data/themes';

export const CARD_W = 1080;
export const CARD_H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('photo'));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    // Hard-break absurdly long tokens (links, keyboard smashes).
    const chunks = word.length > 28 ? (word.match(/.{1,28}/g) ?? [word]) : [word];
    for (const chunk of chunks) {
      const trial = line ? `${line} ${chunk}` : chunk;
      if (ctx.measureText(trial).width > maxWidth && line) {
        lines.push(line);
        line = chunk;
      } else {
        line = trial;
      }
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 22); // cap: card has finite space
}

export async function renderCardToCanvas(card: LoveCard): Promise<HTMLCanvasElement> {
  const theme = getTheme(card.themeId);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Background
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, theme.bg[0]);
  grad.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Soft glow orbs
  for (const [gx, gy, gr] of [[180, 220, 320], [900, 1150, 380]] as const) {
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  // Sprinkled motif
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = theme.accent;
  ctx.font = '44px serif';
  const motifs = theme.pattern === 'stars' ? '✦' : theme.pattern === 'petals' ? '❀' : theme.pattern === 'waves' ? '〜' : '♥';
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 26; i++) {
    const x = rand() * CARD_W;
    const y = rand() * CARD_H;
    ctx.globalAlpha = 0.10 + rand() * 0.16;
    ctx.fillText(motifs, x, y);
  }
  ctx.restore();

  // Frame
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  roundRect(ctx, 48, 48, CARD_W - 96, CARD_H - 96, 36);
  ctx.stroke();
  ctx.restore();

  let cursor = 170;
  ctx.textAlign = 'center';

  // Eyebrow: occasion
  ctx.fillStyle = theme.muted;
  ctx.font = `600 34px ${FONT_STACK.sans}`;
  ctx.fillText('A NOTE FOR', CARD_W / 2, cursor);
  cursor += 84;

  // To name
  ctx.fillStyle = theme.ink;
  ctx.font = `700 76px ${FONT_STACK[theme.font]}`;
  const toName = card.toName || 'My Love';
  ctx.fillText(toName.length > 24 ? `${toName.slice(0, 24)}…` : toName, CARD_W / 2, cursor);
  cursor += 60;

  // Divider
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2 - 130, cursor);
  ctx.lineTo(CARD_W / 2 + 130, cursor);
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.font = '30px serif';
  ctx.fillText('♥', CARD_W / 2, cursor + 10);
  ctx.restore();
  cursor += 90;

  // Photo (optional)
  if (card.photo) {
    try {
      const img = await loadImage(card.photo);
      const pw = 640;
      const ph = Math.min(460, Math.round((pw * img.naturalHeight) / Math.max(1, img.naturalWidth)));
      const px = (CARD_W - pw) / 2;
      ctx.save();
      roundRect(ctx, px, cursor, pw, ph, 28);
      ctx.clip();
      ctx.drawImage(img, px, cursor, pw, ph);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 6;
      roundRect(ctx, px, cursor, pw, ph, 28);
      ctx.stroke();
      ctx.restore();
      cursor += ph + 70;
    } catch {
      /* photo failed — card still renders */
    }
  }

  // Message
  ctx.fillStyle = theme.ink;
  const fontSize = card.message.length > 320 ? 38 : 44;
  ctx.font = `400 ${fontSize}px ${FONT_STACK[theme.font]}`;
  const lines = wrapText(ctx, card.message || '…', CARD_W - 260);
  const lineH = fontSize * 1.5;
  for (const line of lines) {
    if (cursor > CARD_H - 300) break;
    ctx.fillText(line, CARD_W / 2, cursor);
    cursor += lineH;
  }

  // Footer: from + date
  cursor = Math.max(cursor + 30, CARD_H - 250);
  ctx.fillStyle = theme.accent;
  ctx.font = `600 40px ${FONT_STACK[theme.font]}`;
  if (card.fromName) ctx.fillText(`— ${card.fromName}`, CARD_W / 2, cursor);
  if (card.dateLabel) {
    ctx.fillStyle = theme.muted;
    ctx.font = `500 32px ${FONT_STACK.sans}`;
    ctx.fillText(card.dateLabel, CARD_W / 2, cursor + 56);
  }
  // Corner emoji seal
  ctx.font = '64px serif';
  ctx.fillText(card.emoji || '❤️', CARD_W - 140, CARD_H - 120);

  // Wordmark
  ctx.fillStyle = theme.muted;
  ctx.globalAlpha = 0.8;
  ctx.font = `500 26px ${FONT_STACK.sans}`;
  ctx.fillText('made with ♥ in LoveKit', CARD_W / 2, CARD_H - 96);

  return canvas;
}

export async function cardToPngDataUrl(card: LoveCard): Promise<string> {
  const canvas = await renderCardToCanvas(card);
  return canvas.toDataURL('image/png');
}

export async function downloadCardPng(card: LoveCard, filename: string): Promise<void> {
  const url = await cardToPngDataUrl(card);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
