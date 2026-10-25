import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * Fetches one page of items, reading `pageSize` and `pageToken` from the request.
 * It asks for one item more than the page holds: if that item exists, there is a next page.
 */
export function paginate<T>(
  c: Context,
  fetch: (offset: number, limit: number) => T[],
): { items: T[]; nextPageToken?: string } {
  const { offset, limit } = readPageParams(c);
  const items = fetch(offset, limit + 1);
  return {
    items: items.slice(0, limit),
    nextPageToken: items.length > limit ? encodeToken(offset + limit) : undefined,
  };
}

// Answers 400 if either parameter is invalid. A page size over the maximum is reduced to it.
function readPageParams(c: Context): { offset: number; limit: number } {
  const sizeParam = c.req.query('pageSize');
  const size = sizeParam === undefined ? DEFAULT_PAGE_SIZE : Number(sizeParam);
  if (!Number.isInteger(size) || size < 1) {
    throw new HTTPException(400, { message: 'pageSize must be a positive whole number.' });
  }
  const token = c.req.query('pageToken');
  return {
    offset: token === undefined ? 0 : decodeToken(token),
    limit: Math.min(size, MAX_PAGE_SIZE),
  };
}

// Tokens are opaque to clients, so the encoding can change without breaking them.
function encodeToken(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

function decodeToken(token: string): number {
  try {
    const { offset } = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (Number.isInteger(offset) && offset >= 0) return offset;
  } catch {
    // Fall through to the error below.
  }
  throw new HTTPException(400, { message: 'pageToken is not valid.' });
}
