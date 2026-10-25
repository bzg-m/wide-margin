import { describe, expect, it } from 'vitest';
import { sanitizeLine, sanitizeText } from './text.ts';

describe('sanitizeText', () => {
  it('stores visually identical text identically', () => {
    expect(sanitizeText('cafe\u0301')).toBe('caf\u00E9');
  });

  it('keeps tabs and line breaks but removes other control characters', () => {
    expect(sanitizeText('a\tb\nc\u0000d\u0007e')).toBe('a\tb\ncde');
  });

  it('converts Windows and old Mac line endings to \\n', () => {
    expect(sanitizeText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('removes characters that reverse the direction of text', () => {
    expect(sanitizeText('invoice\u202Etxt.exe')).toBe('invoicetxt.exe');
  });

  it('collapses runs of blank lines into one', () => {
    expect(sanitizeText('a\n\n\n \n\nb')).toBe('a\n\nb');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  \n hi \n ')).toBe('hi');
  });

  it('leaves other scripts, emoji and joined emoji unchanged', () => {
    const text = 'Привет 你好 مرحبا 👩\u200D🔬';
    expect(sanitizeText(text)).toBe(text);
  });

  it('changes nothing when applied a second time', () => {
    const once = sanitizeText(' a\r\n\r\n\r\n\u202Eb\u0000 ');
    expect(sanitizeText(once)).toBe(once);
  });
});

describe('sanitizeLine', () => {
  it('turns multi-line text into one line', () => {
    expect(sanitizeLine('A\n\n title\twith  gaps')).toBe('A title with gaps');
  });
});
