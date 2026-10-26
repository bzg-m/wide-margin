<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Role } from '../../shared/api.ts';
import { isShownInStatusArea } from './api/client.ts';
import { onUnauthorized } from './api/index.ts';
import StatusArea from './components/StatusArea.vue';
import { RouteName } from './navigation.ts';
import { useSession } from './stores/session.ts';
import { Priority, useStatus } from './stores/status.ts';

const SIGNED_OUT_PROBLEM = 'signed-out';

const session = useSession();
const status = useStatus();
const route = useRoute();
const router = useRouter();
const main = useTemplateRef<HTMLElement>('main');

// After moving to another page, focus goes to its heading, or to the main area while the page
// loads, so keyboard and screen-reader users start at the top of the new page. A change to the
// query alone, such as opening the new-reading panel, isn't a new page.
router.afterEach(async (to, from) => {
  if (from.matched.length === 0 || to.path === from.path) return;
  await nextTick();
  const target = main.value?.querySelector('h1') ?? main.value;
  if (!target) return;
  target.setAttribute('tabindex', '-1');
  target.focus();
});

// The first page waits for the sign-in check, which can take a few seconds of retries.
const firstPageReady = ref(false);
void router.isReady().finally(() => (firstPageReady.value = true));

/** Goes to sign-in, coming back to this page afterwards. */
function goToSignIn() {
  void router.push({ name: RouteName.SignIn, query: { redirect: route.fullPath } });
}

// A 401 means the sign-in ended elsewhere, such as in another tab. The page stays where it is,
// with anything typed, and the status area offers to sign in again.
onUnauthorized(() => {
  if (!session.user) return;
  status.report({
    id: SIGNED_OUT_PROBLEM,
    message: "You've been signed out, so new posts can't be saved.",
    priority: Priority.SignedOut,
    action: {
      label: 'Sign in',
      run: () => {
        status.resolve(SIGNED_OUT_PROBLEM);
        session.forget();
        goToSignIn();
      },
    },
  });
});

const signOutError = ref('');

async function switchUser() {
  signOutError.value = '';
  try {
    await session.signOutCurrent();
  } catch (error) {
    // Lost connections and ended sign-ins are already shown in the status area.
    if (!isShownInStatusArea(error)) signOutError.value = "Couldn't sign out. Try again.";
    return;
  }
  goToSignIn();
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-inner">
      <RouterLink :to="{ name: RouteName.Readings }" class="app-name">Collab read</RouterLink>
      <div v-if="session.user" class="current-user">
        <span class="identity">
          <span class="user-name" :title="session.user.displayName">
            {{ session.user.displayName }}
          </span>
          <template v-if="session.user.role === Role.Instructor">
            <span class="visually-hidden">, </span>
            <span class="badge">Instructor</span>
          </template>
        </span>
        <button type="button" class="button" @click="switchUser">Switch user</button>
      </div>
    </div>
    <p v-if="signOutError" class="app-header-error error" role="alert">{{ signOutError }}</p>
  </header>
  <StatusArea />
  <main ref="main" class="content">
    <p v-if="!firstPageReady" class="muted">Loading…</p>
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-header-inner {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-2) var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.app-name {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  white-space: nowrap;
}

/* min-width: 0 lets this side shrink, so a long name is cut short instead of pushing the layout. */
.current-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.user-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-user .button {
  flex-shrink: 0;
}

.app-header-error {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 var(--space-4) var(--space-2);
  text-align: right;
}

/* On phones the role goes under the name, so the header stays one row. */
@media (max-width: 479px) {
  .identity {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }

  .identity .badge {
    padding: 0 var(--space-1);
    font-size: 0.75rem;
  }

  .current-user .button {
    padding-inline: var(--space-3);
  }
}

.badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius);
  background: var(--color-instructor);
  color: var(--color-instructor-text);
  font-size: 0.8125rem;
}
</style>
