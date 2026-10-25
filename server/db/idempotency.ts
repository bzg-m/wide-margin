/** Returned by a create when its idempotency key was already used for different content. */
export const KEY_REUSED = 'key-reused';

/**
 * The result of a create that accepts an idempotency key. `isNew` is false when an earlier
 * request with the same key already created `resource`.
 */
export type CreateResult<T> = { resource: T; isNew: boolean } | typeof KEY_REUSED;
