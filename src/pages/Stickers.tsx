import { useCallback, useEffect, useRef, useState } from 'react';
import ShareBox from '../components/ShareBox';
import { fileToDataUrl } from '../lib/images';
import { renderSticker, STICKER_PX, stickerToDataUrl, stickerToTrayUrl } from '../lib/stickerRender';
import { cleanText } from '../lib/sanitize';
import { KEYS, load, save, uid } from '../lib/store';
import type { Sticker, StickerElement, StickerPack } from '../lib/types';
import {
  IMPORT_STEPS,
  STICKER_STARTERS,
  WA_PACK_MAX,
  WA_PACK_MIN,
  WA_STICKER_MAX_KB,
  downloadText,
  downloadUrl,
  packManifest,
  slug,
  stickerSizeLabel,
  validatePack,
} from '../lib/whatsapp';

const STICKER_KEY = 'lovekit.sticker-items.v1';
const EMOJI_CHOICES = ['😍', '🥺', '😂', '😭', '🥰', '😘', '🌙', '☀️', '💋', '🫶', '👀', '📞', '♾️', '🎉'];

function blankSticker(name = 'Untitled sticker'): Sticker {
  const now = Date.now();
  return {
    id: uid('stk'),
    name,
    elements: [],
    backgroundTransparent: true,
    borderWidth: 0,
    borderColor: '#ffffff',
    createdAt: now,
    updatedAt: now,
  };
}

/** Approximate hit-test radius in 512-space. */
function hitRadius(el: StickerElement): { w: number; h: number } {
  if (el.kind === 'image' || el.kind === 'emoji' || el.kind === 'heart') {
    const s = (el.size ?? 140) * el.scale;
    return { w: s, h: s };
  }
  const size = (el.fontSize ?? 64) * el.scale;
  const lines = (el.text ?? '').split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return { w: longest * size * 0.62, h: lines.length * size * 1.2 };
}

export default function Stickers(): React.ReactElement {
  const [items, setItems] = useState<Sticker[]>(() => load<Sticker[]>(STICKER_KEY, []));
  const [packs, setPacks] = useState<StickerPack[]>(() => load<StickerPack[]>(KEYS.packs, []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hist, setHist] = useState<StickerElement[][]>([]);
  const [future, setFuture] = useState<StickerElement[][]>([]);
  const [notice, setNotice] = useState<{ kind: 'good' | 'bad' | 'warn'; text: string } | null>(null);
  const [exportUrl, setExportUrl] = useState('');
  const [packForm, setPackForm] = useState({ name: '', author: '', description: '' });
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const active = items.find((s) => s.id === activeId) ?? null;
  const selected = active?.elements.find((e) => e.id === selectedId) ?? null;
  const activePack = packs.find((p) => p.id === activePackId) ?? null;
  // Mirror for drag handlers: pointermove updates state without hammering
  // localStorage on every pixel; pointerup persists once.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const persistItems = useCallback((list: Sticker[]) => {
    setItems(list);
    if (!save(STICKER_KEY, list).ok) setNotice({ kind: 'bad', text: 'Storage is full — download your stickers to keep them safe!' });
  }, []);
  const persistPacks = useCallback((list: StickerPack[]) => {
    setPacks(list);
    save(KEYS.packs, list);
  }, []);

  const mutate = useCallback(
    (fn: (s: Sticker) => Sticker, commit = false) => {
      if (!active) return;
      if (commit) {
        setHist((h) => [...h.slice(-29), active.elements]);
        setFuture([]);
      }
      persistItems(items.map((s) => (s.id === active.id ? { ...fn(s), updatedAt: Date.now() } : s)));
    },
    [active, items, persistItems],
  );

  const patchSelected = (patch: Partial<StickerElement>, commit = false) => {
    if (!selected) return;
    mutate(
      (s) => ({ ...s, elements: s.elements.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)) }),
      commit,
    );
  };

  const addElement = (el: Omit<StickerElement, 'id'>) => {
    const full: StickerElement = { ...el, id: uid('el') };
    mutate((s) => ({ ...s, elements: [...s.elements, full] }), true);
    setSelectedId(full.id);
  };

  const undo = () => {
    if (!active || hist.length === 0) return;
    const prev = hist[hist.length - 1];
    setFuture((f) => [active.elements, ...f].slice(0, 30));
    setHist((h) => h.slice(0, -1));
    persistItems(items.map((s) => (s.id === active.id ? { ...s, elements: prev } : s)));
  };
  const redo = () => {
    if (!active || future.length === 0) return;
    const [next, ...rest] = future;
    setHist((h) => [...h, active.elements]);
    setFuture(rest);
    persistItems(items.map((s) => (s.id === active.id ? { ...s, elements: next } : s)));
  };

  // Paint the canvas whenever the active sticker changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;
    renderSticker(ctx, active, { halo: true })
      .then(() => {
        if (alive) {
          try {
            setExportUrl(canvas.toDataURL('image/png'));
          } catch {
            /* tainted canvas — shouldn't happen with data-URLs */
          }
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active]);

  const toCanvas = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 256, y: 256 };
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * STICKER_PX,
      y: ((clientY - r.top) / r.height) * STICKER_PX,
    };
  };

  const pickAt = (x: number, y: number): StickerElement | null => {
    if (!active) return null;
    for (let i = active.elements.length - 1; i >= 0; i--) {
      const el = active.elements[i];
      const { w, h } = hitRadius(el);
      if (Math.abs(x - el.x) < w / 2 + 12 && Math.abs(y - el.y) < h / 2 + 12) return el;
    }
    return null;
  };

  const onImageFile = async (file: File | undefined) => {
    if (!file || !active) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ kind: 'bad', text: 'That is not an image file.' });
      return;
    }
    try {
      const url = await fileToDataUrl(file, { maxDim: 512, quality: 0.9, mime: 'image/png' });
      addElement({ kind: 'image', x: 256, y: 256, scale: 1, rotation: 0, image: url, size: 320 });
      setNotice(null);
    } catch {
      setNotice({ kind: 'bad', text: 'Could not read that image.' });
    }
  };

  const exportOne = async (mime: 'image/png' | 'image/webp', sticker: Sticker) => {
    try {
      const url = await stickerToDataUrl(sticker, mime);
      downloadUrl(url, `${slug(sticker.name)}-512.${mime === 'image/png' ? 'png' : 'webp'}`);
      const kb = Math.floor((url.length * 0.75) / 1024);
      setNotice(
        kb > WA_STICKER_MAX_KB
          ? { kind: 'warn', text: `Exported at ~${kb} KB — over WhatsApp's 100 KB limit. Shrink images or drop an element.` }
          : { kind: 'good', text: `Exported “${sticker.name}” at ~${kb} KB. Looking spec-fresh. ✨` },
      );
    } catch {
      setNotice({ kind: 'bad', text: 'Export failed in this browser.' });
    }
  };

  const sizeInfo = exportUrl ? stickerSizeLabel(Math.floor(exportUrl.length * 0.75)) : null;

  const createPack = () => {
    const name = cleanText(packForm.name, 120);
    const author = cleanText(packForm.author, 120);
    if (!name || !author) {
      setNotice({ kind: 'bad', text: 'A pack needs a name and an author.' });
      return;
    }
    const pack: StickerPack = {
      id: uid('pack'),
      name,
      author,
      description: cleanText(packForm.description, 500),
      stickerIds: active ? [active.id] : [],
      createdAt: Date.now(),
    };
    persistPacks([pack, ...packs]);
    setActivePackId(pack.id);
    setPackForm({ name: '', author: '', description: '' });
    setNotice({ kind: 'good', text: `Pack “${name}” created. Add at least ${WA_PACK_MIN} stickers for WhatsApp.` });
  };

  const toggleInPack = (stickerId: string) => {
    if (!activePack) return;
    const has = activePack.stickerIds.includes(stickerId);
    let ids = has ? activePack.stickerIds.filter((x) => x !== stickerId) : [...activePack.stickerIds, stickerId];
    if (ids.length > WA_PACK_MAX) {
      setNotice({ kind: 'warn', text: `WhatsApp packs hold at most ${WA_PACK_MAX} stickers.` });
      ids = ids.slice(0, WA_PACK_MAX);
    }
    persistPacks(packs.map((p) => (p.id === activePack.id ? { ...p, stickerIds: ids } : p)));
  };

  const packCheck = activePack ? validatePack(activePack, activePack.stickerIds.length) : null;

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>😍 Sticker Maker</h1>
        <p>Real 512×512 stickers with transparency — built for WhatsApp, honest about the last mile.</p>
      </div>

      {notice && (
        <p className={`notice ${notice.kind === 'good' ? 'good' : notice.kind === 'warn' ? 'warn' : 'bad'}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="share-box" style={{ marginBottom: '1rem' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            const s = blankSticker(`Sticker ${items.length + 1}`);
            persistItems([s, ...items]);
            setActiveId(s.id);
            setHist([]);
            setFuture([]);
            setSelectedId(null);
          }}
        >
          ＋ New sticker
        </button>
        {items.map((s) => (
          <button key={s.id} className="chip" aria-pressed={s.id === activeId} onClick={() => { setActiveId(s.id); setSelectedId(null); setHist([]); setFuture([]); }}>
            {s.elements.length > 0 ? '⭐' : '▫️'} {s.name}
          </button>
        ))}
      </div>

      {!active ? (
        <div className="empty panel">
          <span className="big">😍</span>
          <p>Create your first sticker — upload a photo, add “Miss You ❤️”, export, and make someone’s chat better.</p>
        </div>
      ) : (
        <div className="sticker-layout">
          <div>
            <div className="sticker-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={STICKER_PX}
                height={STICKER_PX}
                role="application"
                aria-label={`Sticker canvas: ${active.name}. Drag elements to move them.`}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  const { x, y } = toCanvas(e.clientX, e.clientY);
                  const hit = pickAt(x, y);
                  if (hit) {
                    setSelectedId(hit.id);
                    dragRef.current = { id: hit.id, dx: hit.x - x, dy: hit.y - y };
                    setHist((h) => [...h.slice(-29), active.elements]);
                    setFuture([]);
                  } else {
                    setSelectedId(null);
                  }
                }}
                onPointerMove={(e) => {
                  const drag = dragRef.current;
                  if (!drag) return;
                  const { x, y } = toCanvas(e.clientX, e.clientY);
                  const nx = Math.round(x + drag.dx);
                  const ny = Math.round(y + drag.dy);
                  setItems((prev) =>
                    prev.map((s) =>
                      s.id === active.id
                        ? { ...s, elements: s.elements.map((el) => (el.id === drag.id ? { ...el, x: nx, y: ny } : el)) }
                        : s,
                    ),
                  );
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                  if (!save(STICKER_KEY, itemsRef.current).ok) {
                    setNotice({ kind: 'bad', text: 'Storage is full — download your stickers to keep them safe!' });
                  }
                }}
              />
            </div>
            <div className="share-box" style={{ marginTop: '0.7rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={undo} disabled={hist.length === 0}>↩ Undo</button>
              <button className="btn btn-ghost btn-sm" onClick={redo} disabled={future.length === 0}>↪ Redo</button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => mutate((s) => ({ ...s, elements: [] }), true)}
              >
                🗑 Reset
              </button>
              {sizeInfo && (
                <span className="hint" style={{ fontSize: '0.85rem' }}>
                  Current export ≈ {sizeInfo.text} {sizeInfo.over ? '⚠️ over the 100 KB WhatsApp limit' : '✓ within limits'}
                </span>
              )}
            </div>

            <div className="toolbar" style={{ marginTop: '0.9rem' }} aria-label="Add elements">
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                🖼 Photo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImageFile(e.target.files?.[0])} />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => addElement({ kind: 'text', x: 256, y: 256, scale: 1, rotation: 0, text: 'Love You', fontSize: 72, fontWeight: 800, color: '#ffffff', outline: '#b3543f', align: 'center' })}>
                🔤 Text
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => addElement({ kind: 'emoji', x: 256, y: 256, scale: 1, rotation: 0, text: '😍', size: 130 })}>
                😍 Emoji
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => addElement({ kind: 'heart', x: 256, y: 200, scale: 1, rotation: -8, size: 110 })}>
                ❤️ Heart
              </button>
            </div>

            <div className="field" style={{ marginTop: '0.8rem' }}>
              <label>Quick captions <span className="hint">— tap to add</span></label>
              <div className="chips">
                {STICKER_STARTERS.map((s) => (
                  <button
                    key={s}
                    className="chip"
                    onClick={() =>
                      addElement({ kind: 'text', x: 256, y: 400, scale: 1, rotation: -4, text: s, fontSize: 56, fontWeight: 800, color: '#ffffff', outline: '#7c3b2a', align: 'center' })
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label style={{ marginTop: '0.6rem' }}>More emoji <span className="hint">— tap to add</span></label>
              <div className="chips">
                {EMOJI_CHOICES.map((e) => (
                  <button key={e} className="chip" aria-label={`Add emoji ${e}`} onClick={() => addElement({ kind: 'emoji', x: 256, y: 256, scale: 1, rotation: 0, text: e, size: 130 })}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="el-list" aria-label="Layers">
              {active.elements.map((el, i) => (
                <div className="el-row" key={el.id} aria-current={el.id === selectedId}>
                  <span aria-hidden="true">{el.kind === 'text' ? '🔤' : el.kind === 'image' ? '🖼' : el.kind === 'heart' ? '❤️' : '😍'}</span>
                  <span className="grow">{el.kind === 'text' ? el.text : el.kind === 'image' ? 'Photo' : (el.text ?? el.kind)} · layer {i + 1}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setSelectedId(el.id)}>Edit</button>
                </div>
              ))}
              {active.elements.length === 0 && <p className="hint">No layers yet — add a photo, text or emoji to begin.</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Sticker settings</h3>
              <div className="field">
                <label htmlFor="stk-name">Name</label>
                <input id="stk-name" className="input" value={active.name} maxLength={80} onChange={(e) => mutate((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="field">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={active.backgroundTransparent} onChange={(e) => mutate((s) => ({ ...s, backgroundTransparent: e.target.checked }), true)} />
                  Transparent background <span className="hint">(required for WhatsApp)</span>
                </label>
              </div>
              <div className="field">
                <label htmlFor="stk-border">Frame width: {active.borderWidth}px</label>
                <input id="stk-border" type="range" min={0} max={24} value={active.borderWidth} onChange={(e) => mutate((s) => ({ ...s, borderWidth: Number(e.target.value) }), true)} />
              </div>
              <div className="share-box">
                <button className="btn btn-primary btn-sm" onClick={() => void exportOne('image/png', active)}>⬇ PNG 512</button>
                <button className="btn btn-ghost btn-sm" onClick={() => void exportOne('image/webp', active)}>⬇ WebP 512</button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void stickerToTrayUrl(active).then((u) => downloadUrl(u, `${slug(active.name)}-tray-96.png`))}
                >
                  ⬇ Tray 96
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    persistItems(items.filter((s) => s.id !== active.id));
                    persistPacks(packs.map((p) => ({ ...p, stickerIds: p.stickerIds.filter((x) => x !== active.id) })));
                    setActiveId(null);
                  }}
                >
                  Delete
                </button>
              </div>
              {exportUrl && (
                <div style={{ marginTop: '0.8rem' }}>
                  <ShareBox
                    kind="sticker"
                    label="sticker"
                    buildPayload={() => ({ name: cleanText(active.name, 80), image: exportUrl })}
                  />
                </div>
              )}
            </div>

            {selected && (
              <div className="panel" aria-label="Selected element">
                <h3 style={{ marginTop: 0 }}>Selected layer {selected.kind === 'text' ? '🔤' : selected.kind === 'image' ? '🖼' : '😍'}</h3>
                {(selected.kind === 'text' || selected.kind === 'emoji') && (
                  <div className="field">
                    <label htmlFor="el-text">{selected.kind === 'text' ? 'Text' : 'Emoji'}</label>
                    <input
                      id="el-text"
                      className="input"
                      value={selected.text ?? ''}
                      maxLength={120}
                      onChange={(e) => patchSelected({ text: e.target.value })}
                    />
                  </div>
                )}
                {selected.kind === 'text' && (
                  <>
                    <div className="field">
                      <label htmlFor="el-size">Size: {selected.fontSize ?? 64}px</label>
                      <input id="el-size" type="range" min={24} max={160} value={selected.fontSize ?? 64} onChange={(e) => patchSelected({ fontSize: Number(e.target.value) }, true)} />
                    </div>
                    <div className="share-box">
                      <label className="hint">Colour <input type="color" value={selected.color ?? '#ffffff'} onChange={(e) => patchSelected({ color: e.target.value }, true)} /></label>
                      <label className="hint">Outline <input type="color" value={selected.outline ?? '#b3543f'} onChange={(e) => patchSelected({ outline: e.target.value }, true)} /></label>
                    </div>
                  </>
                )}
                {(selected.kind === 'image' || selected.kind === 'emoji' || selected.kind === 'heart') && (
                  <div className="field">
                    <label htmlFor="el-gsize">Size: {selected.size ?? 140}px</label>
                    <input id="el-gsize" type="range" min={40} max={460} value={selected.size ?? 140} onChange={(e) => patchSelected({ size: Number(e.target.value) }, true)} />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="el-rot">Rotation: {selected.rotation}°</label>
                  <input id="el-rot" type="range" min={-180} max={180} value={selected.rotation} onChange={(e) => patchSelected({ rotation: Number(e.target.value) }, true)} />
                </div>
                <div className="field">
                  <label htmlFor="el-scale">Scale: {Math.round(selected.scale * 100)}%</label>
                  <input id="el-scale" type="range" min={20} max={300} value={Math.round(selected.scale * 100)} onChange={(e) => patchSelected({ scale: Number(e.target.value) / 100 }, true)} />
                </div>
                <div className="share-box">
                  <button className="btn btn-ghost btn-sm" onClick={() => patchSelected({ rotation: (selected.rotation + 15) % 360 }, true)}>⟳ +15°</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const els = active.elements;
                      const i = els.findIndex((e) => e.id === selected.id);
                      if (i < els.length - 1) {
                        const next = [...els];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        mutate((s) => ({ ...s, elements: next }), true);
                      }
                    }}
                  >
                    ⬆ Forward
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      mutate((s) => ({ ...s, elements: s.elements.filter((e) => e.id !== selected.id) }), true);
                      setSelectedId(null);
                    }}
                  >
                    Delete layer
                  </button>
                </div>
              </div>
            )}

            <div className="panel">
              <h3 style={{ marginTop: 0 }}>📦 Sticker pack</h3>
              <div className="field">
                <label htmlFor="pack-pick">Working pack</label>
                <select id="pack-pick" className="select" value={activePackId ?? ''} onChange={(e) => setActivePackId(e.target.value || null)}>
                  <option value="">— choose or create below —</option>
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stickerIds.length})
                    </option>
                  ))}
                </select>
              </div>
              {!activePack ? (
                <>
                  <div className="field">
                    <label htmlFor="pack-name">Pack name</label>
                    <input id="pack-name" className="input" value={packForm.name} maxLength={120} onChange={(e) => setPackForm({ ...packForm, name: e.target.value })} placeholder="e.g. Us ❤️" />
                  </div>
                  <div className="field">
                    <label htmlFor="pack-author">Author</label>
                    <input id="pack-author" className="input" value={packForm.author} maxLength={120} onChange={(e) => setPackForm({ ...packForm, author: e.target.value })} placeholder="Your name" />
                  </div>
                  <div className="field">
                    <label htmlFor="pack-desc">Description <span className="hint">(optional)</span></label>
                    <input id="pack-desc" className="input" value={packForm.description} maxLength={500} onChange={(e) => setPackForm({ ...packForm, description: e.target.value })} placeholder="Stickers for my favourite person" />
                  </div>
                  <button className="btn btn-ink btn-sm" onClick={createPack}>Create pack</button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.9rem' }}>
                    <strong>{activePack.name}</strong> by {activePack.author} · {activePack.stickerIds.length}/
                    {WA_PACK_MAX} stickers
                  </p>
                  {packCheck && !packCheck.ok && (
                    <p className="notice warn">{packCheck.errors.join(' ')}</p>
                  )}
                  {packCheck?.ok && <p className="notice good">Pack meets WhatsApp’s size rules. Export below and import via a sticker-maker app. ✅</p>}
                  <div className="chips" style={{ marginBottom: '0.7rem' }}>
                    {items.map((s) => (
                      <button key={s.id} className="chip" aria-pressed={activePack.stickerIds.includes(s.id)} onClick={() => toggleInPack(s.id)}>
                        {activePack.stickerIds.includes(s.id) ? '✓' : '＋'} {s.name}
                      </button>
                    ))}
                  </div>
                  <div className="share-box">
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!packCheck?.ok}
                      onClick={() => {
                        const names = activePack.stickerIds.map((sid) => {
                          const s = items.find((x) => x.id === sid);
                          return { id: sid, name: s?.name ?? sid };
                        });
                        downloadText(packManifest(activePack, names), `${slug(activePack.name)}-pack.json`);
                      }}
                    >
                      ⬇ pack.json manifest
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        for (const [i, sid] of activePack.stickerIds.entries()) {
                          const s = items.find((x) => x.id === sid);
                          if (!s) continue;
                          try {
                            const url = await stickerToDataUrl(s, 'image/png');
                            downloadUrl(url, `${slug(activePack.name)}-${String(i + 1).padStart(2, '0')}.png`);
                          } catch {
                            /* keep exporting the rest */
                          }
                        }
                        setNotice({ kind: 'good', text: `Exported ${activePack.stickerIds.length} stickers. Now import them (see steps below).` });
                      }}
                    >
                      ⬇ Export all PNGs
                    </button>
                  </div>
                  <div style={{ marginTop: '0.6rem' }}>
                    <ShareBox
                      kind="pack"
                      label="sticker pack"
                      buildPayload={() => ({
                        name: activePack.name,
                        author: activePack.author,
                        description: activePack.description,
                        stickers: JSON.stringify(
                          activePack.stickerIds.map((sid) => items.find((x) => x.id === sid)?.name ?? 'Sticker'),
                        ),
                      })}
                    />
                    <p className="hint" style={{ fontSize: '0.8rem' }}>
                      Pack links carry the card (names + author) — PNG files travel separately, they’re too big for URLs.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Getting stickers into WhatsApp</h2>
          <p>the honest version — no fake “Add to WhatsApp” button</p>
        </div>
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            Browsers <strong>cannot</strong> add stickers to WhatsApp directly — there is no web API for it; the
            official “Add to WhatsApp” flow only exists inside installed native apps. Anyone who tells you otherwise
            is selling something. Here’s what actually works:
          </p>
          <ol className="steps">
            {IMPORT_STEPS.map((s) => (
              <li key={s.title}>
                <span>
                  <strong>{s.title}.</strong> {s.body}
                </span>
              </li>
            ))}
          </ol>
          <p className="hint">
            Official specs we target: {STICKER_PX}×{STICKER_PX}px · transparent · under {WA_STICKER_MAX_KB} KB each ·
            tray icon 96×96 · {WA_PACK_MIN}–{WA_PACK_MAX} stickers per pack. Developers: the exported{' '}
            <code>pack.json</code> matches the shape a future Android ContentProvider wrapper needs — see the README
            roadmap.
          </p>
        </div>
      </section>
    </>
  );
}
