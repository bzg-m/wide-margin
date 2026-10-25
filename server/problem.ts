import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { FieldError, Problem } from '../shared/problem.ts';

/** Builds an RFC 9457 error response. */
export function problemResponse(
  c: Context,
  status: ContentfulStatusCode,
  title: string,
  detail?: string,
  errors?: FieldError[],
): Response {
  const body: Problem = { type: 'about:blank', title, status, detail, errors };
  c.header('Content-Type', 'application/problem+json');
  return c.body(JSON.stringify(body), status);
}
