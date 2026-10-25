const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Describes a time relative to now, such as "5 minutes ago" or "yesterday". Times more than a
 * week away are shown as a date, such as "Oct 11". `locale` defaults to the browser's.
 */
export function relativeTime(iso: string, now = Date.now(), locale?: string): string {
  const date = new Date(iso);
  const seconds = Math.round((date.getTime() - now) / 1000);
  const distance = Math.abs(seconds);
  if (distance < MINUTE) return 'just now';
  if (distance >= WEEK) {
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: sameYear ? undefined : 'numeric',
    });
  }
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (distance >= DAY) return format.format(Math.round(seconds / DAY), 'day');
  if (distance >= HOUR) return format.format(Math.round(seconds / HOUR), 'hour');
  return format.format(Math.round(seconds / MINUTE), 'minute');
}

/** The full date and time, for a tooltip next to a relative time. */
export function exactTime(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A count with its noun, singular for exactly one: "1 reply", "3 replies". */
export function countOf(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
