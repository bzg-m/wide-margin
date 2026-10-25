import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import type { User } from '../../shared/api.ts';

/** Names of the app's pages, used for navigation instead of paths. */
export const RouteName = {
  SignIn: 'sign-in',
  Readings: 'readings',
  Reading: 'reading',
  NotFound: 'not-found',
} as const;

/**
 * Decides where a navigation may go, given who is signed in. Returns `true` to allow it, or
 * the page to go to instead: signed-out visitors go to sign-in, which keeps the page they
 * asked for in `redirect`, and signed-in users skip the sign-in page.
 */
export function allowOrRedirect(
  to: Pick<RouteLocationNormalized, 'name' | 'fullPath'>,
  user: User | null,
): true | RouteLocationRaw {
  if (!user && to.name !== RouteName.SignIn) {
    return { name: RouteName.SignIn, query: { redirect: to.fullPath } };
  }
  if (user && to.name === RouteName.SignIn) return { name: RouteName.Readings };
  return true;
}
