import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '../../../shared/api.ts';
import { getSession, signIn, signOut } from '../api/index.ts';
import { ApiError } from '../api/client.ts';

/**
 * Who is signed in. `user` is null when nobody is; `checked` turns true once the server has said.
 * The store keeps the answer for as long as the page is open, so the server is asked once per page load.
 */
export const useSession = defineStore('session', () => {
  const user = ref<User | null>(null);
  const checked = ref(false);

  /** Asks the server who is signed in. A 401 means nobody is; other failures are thrown. */
  async function check(): Promise<void> {
    try {
      user.value = await getSession();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      user.value = null;
    }
    checked.value = true;
  }

  /** Signs in as the user with this ID. */
  async function signInAs(userId: string): Promise<void> {
    user.value = await signIn(userId);
  }

  /** Signs the current user out. */
  async function signOutCurrent(): Promise<void> {
    await signOut();
    user.value = null;
  }

  /** Forgets the user locally, once the server has said they're no longer signed in. */
  function forget(): void {
    user.value = null;
  }

  return { user, checked, check, signInAs, signOutCurrent, forget };
});
