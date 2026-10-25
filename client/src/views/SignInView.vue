<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Role, type User } from '../../../shared/api.ts';
import { isServerUnreachable } from '../api/client.ts';
import { listUsers } from '../api/index.ts';
import { afterSignIn } from '../navigation.ts';
import { useSession } from '../stores/session.ts';

const session = useSession();
const route = useRoute();
const router = useRouter();

const users = ref<User[]>([]);
const loading = ref(true);
const loadError = ref('');
// A lost connection is shown in the status area, so this page only notes that it's waiting.
const waitingForServer = ref(false);
const signInError = ref('');

const groups = computed(() => [
  { label: 'Instructors', users: users.value.filter((u) => u.role === Role.Instructor) },
  { label: 'Students', users: users.value.filter((u) => u.role === Role.Student) },
]);

async function loadUsers() {
  loading.value = true;
  loadError.value = '';
  waitingForServer.value = false;
  try {
    users.value = await listUsers();
  } catch (error) {
    if (isServerUnreachable(error)) waitingForServer.value = true;
    else loadError.value = error instanceof Error ? error.message : 'People failed to load.';
  } finally {
    loading.value = false;
  }
}

async function choose(user: User) {
  signInError.value = '';
  try {
    await session.signInAs(user.id);
    await router.push(afterSignIn(route.query));
  } catch (error) {
    if (isServerUnreachable(error)) return;
    signInError.value = error instanceof Error ? error.message : 'Signing in failed.';
  }
}

onMounted(loadUsers);
</script>

<template>
  <h1>Choose who you are</h1>
  <p class="muted">This demo has no passwords. Pick anyone to continue.</p>

  <p v-if="loading" class="muted">Loading people…</p>
  <p v-else-if="waitingForServer" class="muted">People will appear once the server is reachable.</p>
  <p v-else-if="loadError" class="error">
    {{ loadError }}
    <button type="button" class="button" @click="loadUsers">Retry</button>
  </p>
  <template v-else>
    <p v-if="signInError" class="error" role="alert">{{ signInError }}</p>
    <section v-for="group in groups" :key="group.label" class="group">
      <h2>{{ group.label }}</h2>
      <ul class="people">
        <li v-for="user in group.users" :key="user.id">
          <button type="button" class="button person" @click="choose(user)">
            {{ user.displayName }}
          </button>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.group {
  margin-top: var(--space-6);
}

.people {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: var(--space-3);
}

.person {
  width: 100%;
  text-align: left;
}
</style>
