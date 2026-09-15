import { useMemo, useState } from 'react';
import ShareBox from '../components/ShareBox';
import { downscaleDataUrl, fileToDataUrl } from '../lib/images';
import { cleanText } from '../lib/sanitize';
import { KEYS, load, save, uid } from '../lib/store';
import type { Memory } from '../lib/types';

export default function Memories(): React.ReactElement {
  const [items, setItems] = useState<Memory[]>(() => load<Memory[]>(KEYS.memories, []));
  const [form, setForm] = useState({ title: '', date: '', description: '', location: '', tags: '', photo: undefined as string | undefined, thumb: undefined as string | undefined });
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const persist = (list: Memory[]) => {
    const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setItems(sorted);
    if (!save(KEYS.memories, sorted).ok) setNotice('Storage is full — your memory is precious; screenshot it!');
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(file, { maxDim: 1000, quality: 0.8 });
      const thumb = await downscaleDataUrl(url, { maxDim: 420, quality: 0.62 });
      setForm((f) => ({ ...f, photo: url, thumb }));
    } catch {
      setNotice('Could not read that photo.');
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const title = cleanText(form.title, 120);
    if (!title) {
      setNotice('Give your memory a title — “That rainy auto ride” beats “Untitled”.');
      return;
    }
    const mem: Memory = {
      id: uid('mem'),
      title,
      date: form.date || new Date().toISOString().slice(0, 10),
      description: cleanText(form.description, 2000),
      location: cleanText(form.location, 120) || undefined,
      tags: form.tags.split(',').map((t) => cleanText(t, 30)).filter(Boolean).slice(0, 8),
      photo: form.photo,
      thumb: form.thumb,
      createdAt: Date.now(),
    };
    persist([mem, ...items]);
    setForm({ title: '', date: '', description: '', location: '', tags: '', photo: undefined, thumb: undefined });
    setNotice('Saved — privately, on this device. ❤️');
  };

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return items;
    return items.filter((m) =>
      [m.title, m.description, m.location ?? '', m.tags.join(' ')].join(' ').toLowerCase().includes(f),
    );
  }, [items, filter]);

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>📸 Memories</h1>
        <p>A private timeline. Never public, never searchable — just yours.</p>
      </div>
      {notice && <p className="notice good" role="status">{notice}</p>}

      <div className="stage">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Add a memory</h3>
          <div className="field">
            <label htmlFor="mem-title">Title</label>
            <input id="mem-title" className="input" placeholder="❤️ First Date" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="share-box">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="mem-date">Date</label>
              <input id="mem-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="mem-loc">Place <span className="hint">(optional)</span></label>
              <input id="mem-loc" className="input" placeholder="That corner café" value={form.location} maxLength={120} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="mem-desc">The story</label>
            <textarea id="mem-desc" className="textarea" style={{ minHeight: 90 }} placeholder="Neither of us knew that random coffee would become the beginning of everything…" value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="mem-tags">Tags <span className="hint">(comma separated)</span></label>
            <input id="mem-tags" className="input" placeholder="firsts, travel, food" value={form.tags} maxLength={200} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="mem-photo">Photo <span className="hint">(optional)</span></label>
            <input id="mem-photo" type="file" accept="image/*" className="input" disabled={busy} onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </div>
          <button className="btn btn-primary" onClick={add} disabled={busy}>💾 Save memory</button>
        </div>

        <div>
          <div className="field">
            <label htmlFor="mem-filter" className="sr-only">Search memories</label>
            <input id="mem-filter" className="input" placeholder="🔍 Search your story…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {visible.length === 0 ? (
            <div className="empty panel">
              <span className="big">📸</span>
              <p>{items.length === 0 ? 'No memories yet. The next ordinary day is a good place to start.' : 'Nothing matches that search.'}</p>
            </div>
          ) : (
            <div className="timeline">
              {visible.map((m) => (
                <article key={m.id} className="feature-card memory-card">
                  {m.photo && <img src={m.photo} alt={`Memory: ${m.title}`} loading="lazy" />}
                  <h3>{m.title}</h3>
                  <p className="hint" style={{ fontSize: '0.82rem' }}>
                    📅 {m.date} {m.location ? `· 📍 ${m.location}` : ''}
                  </p>
                  {m.description && <p>{m.description}</p>}
                  <div>{m.tags.map((t) => <span className="tag" key={t}>#{t}</span>)}</div>
                  <div className="share-box" style={{ marginTop: '0.6rem' }}>
                    <ShareBox
                      kind="memory"
                      label="memory"
                      hasPhotos={!!m.photo}
                      buildPayload={(includePhotos) => ({
                        title: m.title,
                        date: m.date,
                        description: m.description,
                        location: m.location ?? '',
                        tags: m.tags.join(', '),
                        ...(includePhotos && m.photo ? { photo: m.thumb ?? m.photo } : {}),
                      })}
                    />
                    <button className="btn btn-sm btn-danger" onClick={() => persist(items.filter((x) => x.id !== m.id))}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
