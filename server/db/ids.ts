/** Converts an API ID to a database ID, or returns undefined if it isn't a valid one. */
export function parseId(id: string): number | undefined {
  return /^[1-9]\d*$/u.test(id) ? Number(id) : undefined;
}
