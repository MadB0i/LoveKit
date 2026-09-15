import { describe, expect, it } from 'vitest';
import { cleanName, cleanText, escapeHtml, isImageDataUrl, isSafeExternalUrl } from '../src/lib/sanitize';

describe('sanitize', () => {
  it('strips control chars and truncates', () => {
    expect(cleanText('hi\u0000\x07there', 100)).toBe('hithere');
    expect(cleanText('x'.repeat(5000), 100)).toHaveLength(100);
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(42)).toBe('');
  });

  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('only allows http(s) external URLs', () => {
    expect(isSafeExternalUrl('https://example.com/x')).toBe(true);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<h1>hi</h1>')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });

  it('recognises image data-URLs and collapses names', () => {
    expect(isImageDataUrl('data:image/png;base64,AAA')).toBe(true);
    expect(isImageDataUrl('data:text/html;base64,AAA')).toBe(false);
    expect(cleanName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });
});
