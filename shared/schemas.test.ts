import { describe, expect, it } from 'vitest';
import { createPostBody, createReadingBody, toFieldErrors } from './schemas.ts';

describe('createPostBody', () => {
  it('returns the cleaned text', () => {
    expect(createPostBody.parse({ text: '  hi\r\n' })).toEqual({ text: 'hi' });
  });

  it('rejects text that looks empty once cleaned', () => {
    expect(createPostBody.safeParse({ text: ' \u200B\n ' }).success).toBe(false);
  });

  it('allows 2,000 characters, counting each emoji as one', () => {
    expect(createPostBody.safeParse({ text: '😀'.repeat(2000) }).success).toBe(true);
    expect(createPostBody.safeParse({ text: '😀'.repeat(2001) }).success).toBe(false);
  });
});

describe('toFieldErrors', () => {
  it('reports each invalid field by name, with its message', () => {
    const { error } = createReadingBody.safeParse({ title: ' ' });

    expect(toFieldErrors(error!)).toEqual([
      { field: 'title', message: "Title can't be empty." },
      { field: 'description', message: 'Description is required.' },
    ]);
  });

  it('keeps only the first problem when a field breaks several rules', () => {
    // Too long and blank at once: only "can't be empty" is reported.
    const { error } = createPostBody.safeParse({ text: '\u200B'.repeat(2001) });

    expect(toFieldErrors(error!)).toEqual([{ field: 'text', message: "Text can't be empty." }]);
  });
});
