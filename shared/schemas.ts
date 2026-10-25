import { z } from 'zod';
import type { FieldError } from './problem.ts';
import { characterCount, isInvisibleOnly, sanitizeLine, sanitizeText } from './text.ts';

/** Maximum lengths, in characters (Unicode code points). */
export const limits = { postText: 2000, readingTitle: 200, readingDescription: 2000 } as const;

/** A required text field: cleaned first, then checked for blankness and length. */
function cleanText(label: string, max: number, clean: (text: string) => string) {
  return (
    z
      .string({ error: `${label} is required.` })
      // Unlike transform(), overwrite() keeps this a string schema, which can still be exported as JSON Schema.
      .overwrite(clean)
      .refine((text) => !isInvisibleOnly(text), `${label} can't be empty.`)
      .refine(
        (text) => characterCount(text) <= max,
        `${label} must be ${max.toLocaleString('en-US')} characters or fewer.`,
      )
  );
}

/** The body for creating a reading. */
export const createReadingBody = z.object({
  title: cleanText('Title', limits.readingTitle, sanitizeLine),
  description: cleanText('Description', limits.readingDescription, sanitizeText),
});

/** The body for creating an annotation or a reply. */
export const createPostBody = z.object({
  text: cleanText('Text', limits.postText, sanitizeText),
});

/** The body for signing in as a seeded user. */
export const signInBody = z.object({ userId: z.string({ error: 'Choose a user.' }) });

/** A validated, cleaned body for creating a reading. */
export type CreateReadingBody = z.infer<typeof createReadingBody>;

/** A validated, cleaned body for creating an annotation or a reply. */
export type CreatePostBody = z.infer<typeof createPostBody>;

/** Turns a Zod error into API field errors: one per field, keeping the first problem reported for each. */
export function toFieldErrors(error: z.core.$ZodError): FieldError[] {
  const errors = new Map<string, string>();
  for (const issue of error.issues) {
    // Zod gives a field's location as a list of keys, such as ['author', 'name'] for a
    // nested field. Joining it gives one name per field: 'author.name'.
    const field = issue.path.join('.');
    if (!errors.has(field)) errors.set(field, issue.message);
  }
  return [...errors].map(([field, message]) => ({ field, message }));
}
