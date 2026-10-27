import type { LocationQuery, RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import type { User } from '../../shared/api.ts';

/** Names of the app's pages, used for navigation instead of paths. */
export const RouteName = {
  SignIn: 'sign-in',
  Readings: 'readings',
  Reading: 'reading',
  NotFound: 'not-found',
} as const;

/** The browser tab's title for a page, such as "Readings · Wide Margin". */
export function pageTitle(name?: string): string {
  return name ? `${name} · Wide Margin` : 'Wide Margin';
}

/**
 * Where to go after signing in: the sign-in page's `redirect`, if it's a path within this app,
 * otherwise the readings list. Only paths starting with a single "/" are followed, so a link
 * can't send someone to another site.
 */
export function afterSignIn(query: LocationQuery): RouteLocationRaw {
  const redirect = query.redirect;
  const isAppPath =
    typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//');
  return isAppPath ? redirect : { name: RouteName.Readings };
}

/**
 * Decides where a navigation may go, given who is signed in. Returns `true` to allow it, or
 * the page to go to instead: signed-out visitors go to sign-in, which keeps the page they
 * asked for in `redirect`, and signed-in users skip the sign-in page, going on to that page.
 */
export function allowOrRedirect(
  to: Pick<RouteLocationNormalized, 'name' | 'fullPath' | 'query'>,
  user: User | null,
): true | RouteLocationRaw {
  if (!user && to.name !== RouteName.SignIn) {
    return { name: RouteName.SignIn, query: { redirect: to.fullPath } };
  }
  if (user && to.name === RouteName.SignIn) return afterSignIn(to.query);
  return true;
}
