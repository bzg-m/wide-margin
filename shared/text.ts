// A control character other than tab or newline.
const CONTROL_CHARACTER = /(?![\t\n])\p{Cc}/gu;
// Characters that override text direction, which can disguise what text says.
const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/gu;
// Three or more line breaks, possibly with spaces between them.
const BLANK_LINE_RUN = /\n[ \t]*\n(?:[ \t]*\n)+/gu;
// Whitespace and characters that take up no space on screen. No /g: it's used with test().
const INVISIBLE_ONLY = /^[\s\u00AD\u200B\u200C\u2060\uFEFF\u200D]*$/u;

/** Cleans user-entered text before it is validated or stored. Applying it twice changes nothing. */
export function sanitizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(CONTROL_CHARACTER, '')
    .replace(BIDI_CONTROL, '')
    .replace(BLANK_LINE_RUN, '\n\n')
    .trim();
}

/** Cleans a single-line field such as a title: like `sanitizeText`, with every run of whitespace as one space. */
export function sanitizeLine(input: string): string {
  return sanitizeText(input).replace(/\s+/gu, ' ');
}

/** Counts characters the way the limits do: one per Unicode code point, so an emoji counts once. */
export function characterCount(text: string): number {
  return [...text].length;
}

/** True if the text would look empty on screen. */
export function isInvisibleOnly(text: string): boolean {
  return INVISIBLE_ONLY.test(text);
}
