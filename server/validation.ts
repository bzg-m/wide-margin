import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';
import { toFieldErrors } from '../shared/schemas.ts';
import { problemResponse } from './problem.ts';

/** Middleware that validates and cleans a JSON body, answering 400 with field errors if it's invalid. */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    // An issue with no field means the body as a whole is wrong, such as an array instead of an object.
    if (errors.some((e) => e.field === '')) {
      return problemResponse(c, 400, 'Invalid request', 'The request body must be a JSON object.');
    }
    return problemResponse(c, 400, 'Invalid request', 'Some fields need attention.', errors);
  });
}
