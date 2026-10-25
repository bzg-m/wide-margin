<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Action, can } from '../../../shared/permissions.ts';
import type { CreatePostBody } from '../../../shared/schemas.ts';
import { ApiError, isServerUnreachable, isShownInStatusArea } from '../api/client.ts';
import { countStudents } from '../api/index.ts';
import PostComposer from '../components/PostComposer.vue';
import ReadingDetails from '../components/ReadingDetails.vue';
import ThreadItem from '../components/ThreadItem.vue';
import { sortThreads, ThreadOrder } from '../discussion.ts';
import { RouteName } from '../navigation.ts';
import { useDiscussion } from '../stores/discussion.ts';
import { useSession } from '../stores/session.ts';

/** A reading and its discussion. */
const props = defineProps<{ readingId: string }>();

const discussion = useDiscussion();
const session = useSession();

const canSeeParticipation = computed(
  () => !!session.user && can(session.user, Action.ViewParticipation),
);
const studentCount = ref<number | null>(null);

const order = ref<ThreadOrder>(ThreadOrder.Newest);
const sortedThreads = computed(() => sortThreads(discussion.threads, order.value));

const loading = ref(false);
const notFound = ref(false);
const loadError = ref('');
// A lost connection is shown in the status area, so this page only notes that it's waiting.
const waitingForServer = ref(false);

// Counts loads, so a load replaced by a newer one (after a route change) leaves the page alone
// when it finishes. Its requests still run to the end; aborting them with an AbortController would
// save that work, but would mean passing a signal through the API client and its retries.
let latestLoad = 0;

async function load() {
  const thisLoad = ++latestLoad;
  loading.value = true;
  notFound.value = false;
  loadError.value = '';
  waitingForServer.value = false;
  try {
    await discussion.show(props.readingId);
  } catch (error) {
    if (thisLoad !== latestLoad) return;
    if (error instanceof ApiError && error.status === 404) notFound.value = true;
    else if (isServerUnreachable(error)) waitingForServer.value = true;
    else if (!isShownInStatusArea(error)) {
      loadError.value = error instanceof Error ? error.message : 'The reading failed to load.';
    }
  } finally {
    if (thisLoad === latestLoad) loading.value = false;
  }
  void loadStudentCount();
}

// The class size only adds "of 12" to the participation count, so if it fails to load, the
// reading still shows, without it. A lost connection is shown in the status area.
async function loadStudentCount() {
  if (!canSeeParticipation.value || studentCount.value !== null) return;
  try {
    studentCount.value = await countStudents();
  } catch {
    // Leave it unknown.
  }
}

watch(() => props.readingId, load, { immediate: true });

const sendThread = (body: CreatePostBody, key: string) => discussion.postThread(body, key);
</script>

<template>
  <p v-if="loading" class="muted">Loading reading…</p>
  <div v-else-if="notFound">
    <h1>This reading doesn't exist</h1>
    <p>
      It may have been removed, or the link may be wrong.
      <RouterLink :to="{ name: RouteName.Readings }">Go to the readings</RouterLink>
    </p>
  </div>
  <p v-else-if="loadError" class="error">
    {{ loadError }}
    <button type="button" class="button" @click="load">Retry</button>
  </p>
  <p v-else-if="waitingForServer" class="muted">
    The reading will appear once the server is reachable.
  </p>
  <div v-else-if="discussion.reading" class="reading-page">
    <div class="layout">
      <ReadingDetails
        class="details-column"
        :reading="discussion.reading"
        :show-participation="canSeeParticipation"
        :student-count="studentCount"
      />
      <section class="discussion" aria-label="Discussion">
        <PostComposer
          :key="`thread:${readingId}`"
          :draft-key="`thread:${readingId}`"
          label="Start a thread"
          placeholder="Ask a question or share an observation"
          :send="sendThread"
        />
        <div v-if="discussion.threads.length > 0" class="toolbar">
          <span class="muted">Sort</span>
          <div class="order" role="group" aria-label="Sort threads">
            <button
              type="button"
              :aria-pressed="order === ThreadOrder.Newest"
              @click="order = ThreadOrder.Newest"
            >
              Newest
            </button>
            <button
              type="button"
              :aria-pressed="order === ThreadOrder.RecentActivity"
              @click="order = ThreadOrder.RecentActivity"
            >
              Recent activity
            </button>
          </div>
        </div>
        <p v-if="discussion.threads.length === 0" class="empty muted">
          No annotations yet. Start the discussion with a question or an observation.
        </p>
        <ThreadItem v-for="thread in sortedThreads" :key="thread.id" :thread="thread" />
      </section>
    </div>
  </div>
</template>

<style scoped>
/* A container, so the layout follows the page's own width. */
.reading-page {
  container-type: inline-size;
}

.layout {
  display: grid;
  gap: var(--space-6);
}

@container (min-width: 760px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    align-items: start;
  }

  .details-column {
    position: sticky;
    top: var(--space-4);
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-4) 0 var(--space-2);
  font-size: 0.875rem;
}

.order {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.order button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.order button[aria-pressed='true'] {
  background: var(--color-instructor);
  color: var(--color-instructor-text);
}

.empty {
  margin-top: var(--space-6);
}
</style>
