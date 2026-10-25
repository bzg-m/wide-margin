import { createRouter, createWebHistory } from 'vue-router';
import { allowOrRedirect, RouteName } from './navigation.ts';
import { useSession } from './stores/session.ts';
import NotFoundView from './views/NotFoundView.vue';
import ReadingsView from './views/ReadingsView.vue';
import ReadingView from './views/ReadingView.vue';
import SignInView from './views/SignInView.vue';

/** The app's router: one page per URL, with a sign-in check before every navigation. */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: { name: RouteName.Readings } },
    { path: '/sign-in', name: RouteName.SignIn, component: SignInView },
    { path: '/readings', name: RouteName.Readings, component: ReadingsView },
    { path: '/readings/:readingId', name: RouteName.Reading, component: ReadingView, props: true },
    { path: '/:path(.*)*', name: RouteName.NotFound, component: NotFoundView },
  ],
});

router.beforeEach(async (to) => {
  const session = useSession();
  if (!session.checked) {
    try {
      await session.check();
    } catch {
      // A lost connection is already in the status area, reported by the API client. Without an
      // answer, nobody counts as signed in, so the visitor sees the sign-in page.
    }
  }
  return allowOrRedirect(to, session.user);
});
