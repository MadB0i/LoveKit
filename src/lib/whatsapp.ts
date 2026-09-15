/**
 * whatsapp.ts — the honest WhatsApp sticker integration story.
 *
 * Researched constraints (official WhatsApp sticker requirements):
 * - Each sticker: exactly 512×512 px, WebP with transparency, < 100 KB.
 * - Tray/pack icon: 96×96 px, < 50 KB.
 * - A pack holds 3–30 stickers.
 * - There is NO web API to push stickers into WhatsApp. On Android/iOS the
 *   official path is a native app using WhatsApp's sticker ContentProvider /
 *   third-party keyboard flow ("Add to WhatsApp" only exists inside a native
 *   app the user installs). Browsers cannot do it.
 *
 * So LoveKit web does the useful part: a real editor, spec-valid assets,
 * a portable pack manifest, and step-by-step import instructions — and the
 * code is structured so a future native wrapper can reuse the same manifest
 * (see `docs/android-stickers.md` roadmap note in README).
 */

import type { StickerPack } from './types';
import { cleanText, clampInt } from './sanitize';

export const WA_STICKER_SIZE = 512;
export const WA_STICKER_MAX_KB = 100;
export const WA_TRAY_SIZE = 96;
export const WA_TRAY_MAX_KB = 50;
export const WA_PACK_MIN = 3;
export const WA_PACK_MAX = 30;

/**
 * Frozen pack-manifest schema version. The future Android wrapper keys off
 * `format` + `version`: version 1 manifests MUST keep the shape documented
 * in the README ("Sticker pack schema"). Bump only with a migration note.
 */
export const PACK_SCHEMA_VERSION = 1;
export const PACK_SCHEMA_FORMAT = 'lovekit-sticker-pack';

export interface PackCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePack(pack: Pick<StickerPack, 'name' | 'author'>, stickerCount: number): PackCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = cleanText(pack.name, 120);
  const author = cleanText(pack.author, 120);
  if (!name) errors.push('Give your pack a name.');
  if (!author) errors.push('Add an author name (usually yours).');
  if (stickerCount < WA_PACK_MIN) {
    errors.push(`WhatsApp packs need at least ${WA_PACK_MIN} stickers — you have ${stickerCount}.`);
  }
  if (stickerCount > WA_PACK_MAX) {
    errors.push(`WhatsApp packs hold at most ${WA_PACK_MAX} stickers — you have ${stickerCount}.`);
  }
  if (stickerCount > 0 && stickerCount < WA_PACK_MIN) {
    warnings.push('Keep creating — you can already download each sticker as a 512×512 PNG.');
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Portable manifest: the same JSON a future Android wrapper would consume. */
export function packManifest(pack: StickerPack, stickerNames: { id: string; name: string }[]): string {
  return JSON.stringify(
    {
      format: PACK_SCHEMA_FORMAT,
      version: PACK_SCHEMA_VERSION,
      android: {
        identifier: `lovekit.${pack.id.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
        publisher: cleanText(pack.author, 120),
        trayImageFile: 'tray_icon.png',
      },
      name: cleanText(pack.name, 120),
      author: cleanText(pack.author, 120),
      description: cleanText(pack.description, 500),
      stickers: stickerNames.map((s, i) => ({
        file: `sticker_${String(i + 1).padStart(2, '0')}.png`,
        emoji: ['❤️'],
        name: cleanText(s.name, 80),
      })),
      whatsappSpecs: {
        stickerPx: WA_STICKER_SIZE,
        stickerMaxKb: WA_STICKER_MAX_KB,
        trayPx: WA_TRAY_SIZE,
        trayMaxKb: WA_TRAY_MAX_KB,
      },
    },
    null,
    2,
  );
}

export const STICKER_STARTERS: string[] = [
  'Miss You ❤️',
  'Good Morning ☀️',
  'Sorry 🥺',
  'Love You ❤️',
  'Come Here 🥺',
  'Good Night 🌙',
  "I'm Angry 😤",
  'Okay Baby 😂',
  'Muah 💋',
  'Proud of You ❤️',
  'Thinking of You',
  'Forever ♾️',
  'Call Me 📞',
  'Where Are You? 👀',
];

export const IMPORT_STEPS: { title: string; body: string }[] = [
  {
    title: 'Download your stickers',
    body: 'Export each sticker as PNG (512×512, transparent). They already meet WhatsApp’s size requirements.',
  },
  {
    title: 'Use the LoveKit Android bridge (recommended)',
    body: 'Install the bridge from android/ in this repo, export pack.json + tray_icon.png + sticker_01.png … into one folder, and tap Import. It validates everything and performs WhatsApp’s official add flow — no renames, no third-party apps.',
  },
  {
    title: 'Or use a sticker-maker app as the bridge',
    body: 'Send the PNGs to your phone and import them with any reputable “Sticker Maker” app (create pack → add PNGs → Add to WhatsApp).',
  },
];

/** Trigger a browser download for a data-URL or blob URL. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** File-safe slug for sticker downloads. */
export function slug(name: string, fallback = 'sticker'): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

export function stickerSizeLabel(bytes: number): { text: string; over: boolean } {
  const kb = bytes / 1024;
  return { text: `${kb.toFixed(0)} KB`, over: kb > WA_STICKER_MAX_KB };
}

export interface ManifestCheck {
  ok: boolean;
  errors: string[];
}

/**
 * Validate an *imported* pack.json (bridge input, file import, tests).
 * Same rules the exporter guarantees — the Android wrapper runs this before
 * touching WhatsApp. Rejects wrong format/version, bad counts, bad names.
 */
export function validatePackManifest(raw: unknown): ManifestCheck {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Not a pack manifest object.'] };
  }
  const m = raw as Record<string, unknown>;
  if (m.format !== PACK_SCHEMA_FORMAT) errors.push(`Unknown format (want "${PACK_SCHEMA_FORMAT}").`);
  if (m.version !== PACK_SCHEMA_VERSION) {
    errors.push(`Unsupported manifest version (want ${PACK_SCHEMA_VERSION}).`);
  }
  if (!cleanText(typeof m.name === 'string' ? m.name : '', 120)) errors.push('Pack needs a name.');
  if (!cleanText(typeof m.author === 'string' ? m.author : '', 120)) errors.push('Pack needs an author.');
  if (!Array.isArray(m.stickers)) {
    errors.push('Manifest needs a stickers array.');
  } else {
    if (m.stickers.length < WA_PACK_MIN || m.stickers.length > WA_PACK_MAX) {
      errors.push(`Pack needs ${WA_PACK_MIN}–${WA_PACK_MAX} stickers (has ${m.stickers.length}).`);
    }
    m.stickers.forEach((s, i) => {
      const r = (s ?? {}) as Record<string, unknown>;
      if (typeof r.file !== 'string' || !/^sticker_\d{2}\.(png|webp)$/.test(r.file)) {
        errors.push(`Sticker #${i + 1} has a bad file name (want sticker_NN.png).`);
      }
      if (!Array.isArray(r.emoji) || r.emoji.length === 0) {
        errors.push(`Sticker #${i + 1} needs at least one emoji.`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

export { clampInt };
