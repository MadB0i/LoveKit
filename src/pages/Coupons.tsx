import { useState } from 'react';
import ShareBox from '../components/ShareBox';
import { cleanText } from '../lib/sanitize';
import { KEYS, isCoupon, loadArray, save, uid } from '../lib/store';
import type { Coupon } from '../lib/types';

const IDEAS = [
  { title: '1 Free Hug', description: 'Redeemable anytime, anywhere. No expiry on affection (but this coupon has one).' },
  { title: 'Movie Night', description: 'They pick the film. You bring the snacks and zero phone-checking.' },
  { title: 'You Pick Dinner', description: 'Their choice, your treat. No vetoes, no “I’m fine with anything”.' },
  { title: 'Long Call', description: 'One uninterrupted, rambling, wonderful call. Tea mandatory.' },
  { title: 'Surprise Date', description: 'Planned entirely by you. Budget: thoughtfulness.' },
  { title: 'One Big Apology', description: 'For the next small foot-in-mouth moment. Use wisely.' },
  { title: 'Date Night, My Treat', description: 'Dinner, setting, playlist — planned by me. Phones on silent, your call on everything else. 💋' },
  { title: 'Uninterrupted Evening', description: 'No friends, no family, no notifications. Just us, for one whole evening. 💋' },
  { title: 'Your Choice ❤️', description: 'A blank cheque of kindness. The holder decides.' },
];

const DESIGNS = [
  { id: 'rose', name: 'Rose', bg: 'linear-gradient(135deg,#6e3542,#b3543f)', ink: '#fff6ef' },
  { id: 'gold', name: 'Gold', bg: 'linear-gradient(135deg,#7a5b1e,#c99a3c)', ink: '#fff9ec' },
  { id: 'midnight', name: 'Midnight', bg: 'linear-gradient(135deg,#141b2e,#3b4a73)', ink: '#eef2ff' },
  { id: 'sage', name: 'Sage', bg: 'linear-gradient(135deg,#3c4f3a,#7a9a76)', ink: '#f4f8ee' },
  { id: 'cream', name: 'Cream', bg: 'linear-gradient(135deg,#f3e8d3,#e0c9a6)', ink: '#4a3226' },
];

function couponCode(): string {
  const words = ['HUG', 'LOVE', 'DATE', 'STAR', 'MOON', 'BEAR', 'LUCK', 'SWEET'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `${w}-${n}`;
}

export default function Coupons(): React.ReactElement {
  const [items, setItems] = useState<Coupon[]>(() => loadArray(KEYS.coupons, isCoupon));
  const [form, setForm] = useState({ title: '', description: '', designId: 'rose', expiry: '' });
  const [notice, setNotice] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);

  const persist = (list: Coupon[]) => {
    setItems(list);
    if (!save(KEYS.coupons, list).ok) {
      setNotice({ kind: 'bad', text: 'Storage is full or blocked — screenshot your coupons to keep them!' });
    }
  };

  const add = () => {
    const title = cleanText(form.title, 80);
    if (!title) {
      setNotice({ kind: 'bad', text: 'Name your coupon first — “1 Free Hug” is a classic for a reason.' });
      return;
    }
    const c: Coupon = {
      id: uid('cpn'),
      title,
      description: cleanText(form.description, 500),
      designId: form.designId,
      expiry: form.expiry || undefined,
      redeemed: false,
      code: couponCode(),
      createdAt: Date.now(),
    };
    persist([c, ...items]);
    setForm({ title: '', description: '', designId: 'rose', expiry: '' });
    setNotice({ kind: 'good', text: 'Coupon created — send it and await the grin. ❤️' });
  };

  const designOf = (id: string) => DESIGNS.find((d) => d.id === id) ?? DESIGNS[0];

  return (
    <>
      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>🎟️ Love coupons</h1>
        <p>Promises, beautifully printed. Honour system enforced by love.</p>
      </div>
      {notice && <p className={`notice ${notice.kind}`} role="status">{notice.text}</p>}

      <div className="stage">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Design a coupon</h3>
          <div className="field">
            <label>Ideas <span className="hint">— tap to pre-fill</span></label>
            <div className="chips">
              {IDEAS.map((idea) => (
                <button key={idea.title} className="chip" onClick={() => setForm({ ...form, title: idea.title, description: idea.description })}>
                  {idea.title}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="cpn-title">Title</label>
            <input id="cpn-title" className="input" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="1 Free Hug" />
          </div>
          <div className="field">
            <label htmlFor="cpn-desc">Fine print (the sweet kind)</label>
            <textarea id="cpn-desc" className="textarea" style={{ minHeight: 70 }} value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Redeemable with one dramatic presentation…" />
          </div>
          <div className="field">
            <label>Design</label>
            <div className="chips">
              {DESIGNS.map((d) => (
                <button key={d.id} className="chip" aria-pressed={form.designId === d.id} onClick={() => setForm({ ...form, designId: d.id })}>
                  <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: d.bg, marginRight: 6 }} aria-hidden="true" />
                  {d.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="cpn-exp">Expiry <span className="hint">(optional — undated love lasts longer)</span></label>
            <input id="cpn-exp" type="date" className="input" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={add}>🎟️ Create coupon</button>
        </div>

        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          {items.length === 0 && (
            <div className="empty panel">
              <span className="big">🎟️</span>
              <p>No coupons yet. Promise something small and wonderful.</p>
            </div>
          )}
          {items.map((c) => {
            const d = designOf(c.designId);
            const expired = c.expiry ? c.expiry < new Date().toISOString().slice(0, 10) : false;
            return (
              <article key={c.id} className={`coupon ${c.redeemed ? 'redeemed' : ''}`} style={{ background: d.bg, color: d.ink }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'start' }}>
                  <h3 style={{ margin: 0 }}>{c.title}</h3>
                  <span className="code" style={{ color: d.ink }}>{c.code}</span>
                </div>
                {c.description && <p style={{ opacity: 0.92 }}>{c.description}</p>}
                <p style={{ fontSize: '0.82rem', opacity: 0.85, margin: '0.3rem 0 0.7rem' }}>
                  {c.expiry ? `Valid until ${c.expiry}` : 'No expiry — like the good stuff.'}
                  {expired && !c.redeemed ? ' · ⚠️ expired (honour system: renew it!)' : ''}
                  {c.redeemed ? ' · ✅ redeemed with love' : ''}
                </p>
                <div className="share-box">
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(255,255,255,0.9)', color: '#333' }}
                    onClick={() => persist(items.map((x) => (x.id === c.id ? { ...x, redeemed: !x.redeemed } : x)))}
                  >
                    {c.redeemed ? '↩ Un-redeem' : '✅ Mark redeemed'}
                  </button>
                  <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid currentColor', color: d.ink }} onClick={() => persist(items.filter((x) => x.id !== c.id))}>
                    Delete
                  </button>
                </div>
                <div style={{ marginTop: '0.6rem' }}>
                  <ShareBox
                    kind="coupon"
                    label="coupon"
                    buildPayload={() => ({ title: c.title, description: c.description, code: c.code, expiry: c.expiry ?? '', design: c.designId })}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
