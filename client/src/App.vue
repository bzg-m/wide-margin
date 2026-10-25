<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Role } from '../../shared/api.ts';
import { isServerUnreachable } from './api/client.ts';
import StatusArea from './components/StatusArea.vue';
import { RouteName } from './navigation.ts';
import { useSession } from './stores/session.ts';

const session = useSession();
const router = useRouter();

// The first page waits for the sign-in check, which can take a few seconds of retries.
const firstPageReady = ref(false);
void router.isReady().finally(() => (firstPageReady.value = true));

const signOutError = ref('');

async function switchUser() {
  signOutError.value = '';
  try {
    await session.signOutCurrent();
  } catch (error) {
    // A lost connection is already shown in the status area.
    if (!isServerUnreachable(error)) signOutError.value = "Couldn't sign out. Try again.";
    return;
  }
  await router.push({ name: RouteName.SignIn });
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-inner">
      <RouterLink :to="{ name: RouteName.Readings }" class="app-name">Collab read</RouterLink>
      <div v-if="session.user" class="current-user">
        <span>{{ session.user.displayName }}</span>
        <span v-if="session.user.role === Role.Instructor" class="badge">Instructor</span>
        <button type="button" class="button" @click="switchUser">Switch user</button>
        <span v-if="signOutError" class="error" role="alert">{{ signOutError }}</span>
      </div>
    </div>
  </header>
  <StatusArea />
  <main class="content">
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
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}

.current-user {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius);
  background: var(--color-instructor);
  color: var(--color-instructor-text);
  font-size: 0.8125rem;
}
</style>
