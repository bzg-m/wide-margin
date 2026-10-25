/** One send of a create request: the idempotency key and the cleaned body it was sent with. */
export type Attempt<T> = { key: string; body: T };

/**
 * The attempt for sending `body`. If the body is unchanged since the last attempt, its key is
 * reused, so a retry can't create a duplicate. Changed content is a new request with a new key.
 */
export function attemptFor<T>(
  body: T,
  last: Attempt<T> | undefined,
  newKey: () => string = () => crypto.randomUUID(),
): Attempt<T> {
  // Request bodies are flat objects of strings built by the same schema, so comparing their
  // JSON compares their contents.
  const unchanged = last !== undefined && JSON.stringify(last.body) === JSON.stringify(body);
  return { key: unchanged ? last.key : newKey(), body };
}
