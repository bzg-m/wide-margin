<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Annotation } from '../../../shared/api.ts';
import type { CreatePostBody } from '../../../shared/schemas.ts';
import { isServerUnreachable, isShownInStatusArea } from '../api/client.ts';
import { relativeTime } from '../format.ts';
import { useNow } from '../now.ts';
import { useDiscussion } from '../stores/discussion.ts';
import PostComposer from './PostComposer.vue';
import PostContent from './PostContent.vue';

/** One annotation and, when opened, its replies (oldest first) and a reply box. */
const props = defineProps<{ annotation: Annotation }>();

const discussion = useDiscussion();
const now = useNow();
const open = computed(() => discussion.isOpen(props.annotation.id));
const loading = ref(false);
const loadError = ref('');

const replies = computed(() => discussion.replies[props.annotation.id]);
const repliesId = computed(() => `replies-${props.annotation.id}`);
const toggleLabel = computed(() => {
  const count = props.annotation.replyCount;
  if (count === 0) return 'Reply';
  const last = relativeTime(props.annotation.lastActivityAt, now.value);
  return `${count} ${count === 1 ? 'reply' : 'replies'} · last ${last}`;
});
// For screen readers, which reach every toggle in turn: says whose annotation it belongs to. It
// starts with the visible label, so voice control finds the button by what's on screen.
const toggleName = computed(() => {
  const author = props.annotation.authorDisplayName;
  return props.annotation.replyCount === 0
    ? `Reply to ${author}`
    : `${toggleLabel.value}, on ${author}'s annotation`;
});

async function loadReplies() {
  loading.value = true;
  loadError.value = '';
  try {
    await discussion.loadReplies(props.annotation.id);
  } catch (error) {
    if (isServerUnreachable(error)) {
      loadError.value = 'Replies will load once the server is reachable.';
    } else if (!isShownInStatusArea(error)) {
      loadError.value = error instanceof Error ? error.message : 'Replies failed to load.';
    }
  } finally {
    loading.value = false;
  }
}

// Replies load when the annotation opens, whether opened here or by "Show all replies".
watch(
  open,
  (isOpen) => {
    if (isOpen && !replies.value && !loading.value) void loadReplies();
  },
  { immediate: true },
);

const sendReply = (body: CreatePostBody, key: string) =>
  discussion.postReply(props.annotation.id, body, key);
</script>

<template>
  <article class="annotation">
    <PostContent
      :author-id="annotation.authorId"
      :author-display-name="annotation.authorDisplayName"
      :author-role="annotation.authorRole"
      :created-at="annotation.createdAt"
      :text="annotation.text"
    />
    <button
      type="button"
      class="toggle"
      :aria-label="toggleName"
      :aria-expanded="open"
      :aria-controls="repliesId"
      @click="discussion.toggle(annotation.id)"
    >
      {{ toggleLabel }}
    </button>
    <div v-if="open" :id="repliesId" class="replies">
      <p v-if="loading && !replies" class="muted">Loading replies…</p>
      <p v-else-if="loadError" class="muted">
        {{ loadError }}
        <button type="button" class="button" @click="loadReplies">Retry</button>
      </p>
      <ol v-if="replies && replies.length > 0" class="reply-list">
        <li v-for="reply in replies" :key="reply.id">
          <PostContent
            :author-id="reply.authorId"
            :author-display-name="reply.authorDisplayName"
            :author-role="reply.authorRole"
            :created-at="reply.createdAt"
            :text="reply.text"
          />
        </li>
      </ol>
      <PostComposer
        :draft-key="`reply:${annotation.id}`"
        :label="`Reply to ${annotation.authorDisplayName}`"
        :placeholder="`Reply to ${annotation.authorDisplayName}`"
        :send="sendReply"
      />
    </div>
  </article>
</template>

<style scoped>
.annotation {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.toggle {
  min-height: 44px;
  margin-left: var(--space-2);
  border: none;
  background: none;
  color: var(--color-accent);
  font-size: 0.875rem;
}

.replies {
  margin: var(--space-2) 0 0 var(--space-4);
  padding-left: var(--space-3);
  border-left: 1px solid var(--color-border);
}

.reply-list {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
}
</style>
