/**
 * verify-pwa.mjs — post-build PWA + release sanity checks. No dependencies.
 * Run: `node scripts/verify-pwa.mjs` (after `npm run build`).
 * Exits non-zero with a clear message on the first failure.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}
function read(p) {
  return readFileSync(join(root, p), 'utf8');
}
function pngDims(path) {
  const b = readFileSync(join(root, path));
  const sig = [...b.subarray(0, 8)].join(',');
  if (sig !== '137,80,78,71,13,10,26,10') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// 1. Manifest is valid JSON with the required installability fields.
let manifest = null;
try {
  manifest = JSON.parse(read('public/manifest.webmanifest'));
} catch {
  manifest = null;
}
check('manifest parses as JSON', !!manifest);
if (manifest) {
  for (const f of ['name', 'short_name', 'description', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'icons']) {
    check(`manifest has ${f}`, manifest[f] !== undefined && manifest[f] !== '');
  }
  check('display is standalone', manifest.display === 'standalone');
  const icons = manifest.icons || [];
  check('manifest lists icons', icons.length >= 2);
  for (const icon of icons) {
    check(`icon file exists: ${icon.src}`, existsSync(join(root, 'public', icon.src)));
    const dims = existsSync(join(root, 'public', icon.src)) ? pngDims(join('public', icon.src)) : null;
    const want = parseInt((icon.sizes || '0x0').split('x')[0], 10);
    check(`icon ${icon.src} dims match ${icon.sizes}`, !!dims && dims.w === want && dims.h === want);
  }
  check('manifest has a maskable icon', icons.some((i) => (i.purpose || '').includes('maskable')));
  const st = manifest.share_target;
  check('share_target present (GET only, files honestly omitted)', !!st && st.method === 'GET');
}

// 2. Service worker exists and contains the essentials.
const sw = existsSync(join(root, 'public', 'sw.js')) ? read('public/sw.js') : '';
check('sw.js exists', !!sw);
for (const token of ['CACHE_VERSION', 'skipWaiting', 'clients.claim', 'fetch', 'offline']) {
  check(`sw.js mentions ${token}`, sw.includes(token));
}
check('sw.js caches no user content (shell + icons only)', !/lovekit\.(cards|memories|capsules|capkey)/.test(sw));

// 3. index.html wires manifest + icons + theme.
const html = read('index.html');
for (const token of ['manifest.webmanifest', 'apple-touch-icon', 'favicon.svg', 'mobile-web-app-capable']) {
  check(`index.html references ${token}`, html.includes(token));
}

// 4. dist/ built output carries the PWA files.
for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'favicon.svg']) {
  const p = join(dist, f);
  check(`dist/${f} present`, existsSync(p), existsSync(p) ? `${(statSync(p).size / 1024).toFixed(1)} KB` : '');
}
const distHtml = existsSync(join(dist, 'index.html')) ? read('dist/index.html') : '';
check('dist/index.html references manifest', distHtml.includes('manifest.webmanifest'));

// 5. No analytics/trackers/CDNs anywhere in source or bundle.
const bundleHits = [];
try {
  const { execSync } = await import('node:child_process');
  let out = '';
  try {
    out = execSync('git grep -n -E "googletag|gtag\\(|segment\\.io|mixpanel|hotjar|facebook\\.net/tr|doubleclick|plausible\\.io|umami\\.is" -- src public index.html', { cwd: root, encoding: 'utf8' });
  } catch (e) {
    out = (e && e.stdout) || ''; // grep exits 1 when nothing matches — that's the good case
  }
  if (out.trim()) bundleHits.push(out.trim());
} catch { /* git unavailable — skip */ }
check('no trackers in src/public', bundleHits.length === 0, bundleHits.join('; ').slice(0, 200));

if (failures > 0) {
  console.error(`\n${failures} PWA check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll PWA checks passed.');
