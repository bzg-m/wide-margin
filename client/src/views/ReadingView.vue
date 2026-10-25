<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { Action, can } from '../../../shared/permissions.ts';
import type { CreatePostBody } from '../../../shared/schemas.ts';
import { ApiError, isServerUnreachable, isShownInStatusArea } from '../api/client.ts';
import { countStudents } from '../api/index.ts';
import AnnotationItem from '../components/AnnotationItem.vue';
import PostComposer from '../components/PostComposer.vue';
import ReadingDetails from '../components/ReadingDetails.vue';
import { AnnotationOrder, sortAnnotations } from '../discussion.ts';
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
const canReview = computed(() => !!session.user && can(session.user, Action.ReviewDiscussion));

const order = ref<AnnotationOrder>(AnnotationOrder.Newest);
const sortedAnnotations = computed(() => sortAnnotations(discussion.annotations, order.value));

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
    if (error instanceof ApiError && error.status === 404) {
      notFound.value = true;
      discussion.leave(); // Nothing to listen for.
    } else if (isServerUnreachable(error)) waitingForServer.value = true;
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

// Watches whether the top of the annotation list is on screen, for the new-annotations button.
const listTop = useTemplateRef<HTMLElement>('list-top');
let topObserver: IntersectionObserver | undefined;
watch(listTop, (element) => {
  topObserver?.disconnect();
  if (!element) return;
  topObserver = new IntersectionObserver(([entry]) =>
    discussion.setTopInView(entry.isIntersecting),
  );
  topObserver.observe(element);
});

function showNewAnnotations() {
  listTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onUnmounted(() => {
  topObserver?.disconnect();
  discussion.leave();
});

const loadingAllReplies = ref(false);
const allRepliesError = ref('');

// A lost connection is already shown in the status area, so it isn't repeated here.
async function toggleAllReplies() {
  if (discussion.allRepliesShown) {
    discussion.hideAllReplies();
    return;
  }
  loadingAllReplies.value = true;
  allRepliesError.value = '';
  try {
    await discussion.showAllReplies();
  } catch (error) {
    if (!isServerUnreachable(error) && !isShownInStatusArea(error)) {
      allRepliesError.value = error instanceof Error ? error.message : 'Replies failed to load.';
    }
  } finally {
    loadingAllReplies.value = false;
  }
}

const sendAnnotation = (body: CreatePostBody, key: string) => discussion.postAnnotation(body, key);
</script>

<template>
  <p v-if="loading" class="muted">Loading reading…</p>
  <!-- Shown whenever the reading is loaded, including when a reconnect brings it after a failed first load. -->
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
          :key="`annotation:${readingId}`"
          :draft-key="`annotation:${readingId}`"
          label="Add an annotation"
          placeholder="Ask a question or share an observation"
          :send="sendAnnotation"
        />
        <div class="toolbar">
          <template v-if="discussion.annotations.length > 0">
            <span class="muted">Sort</span>
            <div class="order" role="group" aria-label="Sort annotations">
              <button
                type="button"
                :aria-pressed="order === AnnotationOrder.Newest"
                @click="order = AnnotationOrder.Newest"
              >
                Newest
              </button>
              <button
                type="button"
                :aria-pressed="order === AnnotationOrder.RecentActivity"
                @click="order = AnnotationOrder.RecentActivity"
              >
                Recent activity
              </button>
            </div>
            <button
              v-if="canReview && discussion.reading.replyCount > 0"
              type="button"
              class="all-replies"
              :disabled="loadingAllReplies"
              @click="toggleAllReplies"
            >
              {{
                loadingAllReplies
                  ? 'Loading replies…'
                  : discussion.allRepliesShown
                    ? 'Hide all replies'
                    : 'Show all replies'
              }}
            </button>
            <span v-if="allRepliesError" class="error">{{ allRepliesError }}</span>
          </template>
          <!-- A quiet reassurance; problems with live updates appear in the status area. -->
          <span v-if="discussion.live" class="live muted">Live updates on</span>
        </div>
        <button
          v-if="discussion.unseenNewAnnotations > 0"
          type="button"
          class="new-annotations"
          @click="showNewAnnotations"
        >
          {{ discussion.unseenNewAnnotations }} new
          {{ discussion.unseenNewAnnotations === 1 ? 'annotation' : 'annotations' }} ↑
        </button>
        <div ref="list-top" />
        <p v-if="discussion.annotations.length === 0" class="empty muted">
          No annotations yet. Start the discussion with a question or an observation.
        </p>
        <AnnotationItem
          v-for="annotation in sortedAnnotations"
          :key="annotation.id"
          :annotation="annotation"
        />
      </section>
    </div>
  </div>
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
  flex-wrap: wrap;
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

.all-replies {
  min-height: 44px;
  border: none;
  background: none;
  color: var(--color-accent);
}

.empty {
  margin-top: var(--space-6);
}

.live {
  margin-left: auto;
  font-size: 0.8125rem;
}

/* Stays at the top of the screen while scrolled down, until clicked or the top comes into view. */
.new-annotations {
  position: sticky;
  top: var(--space-2);
  z-index: 1;
  display: block;
  margin: 0 auto var(--space-2);
  padding: var(--space-1) var(--space-4);
  min-height: 36px;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-accent);
}
</style>
