<script setup lang="ts">
import { computed } from 'vue';
import { Role } from '../../../shared/api.ts';
import { exactTime, relativeTime } from '../format.ts';
import { useNow } from '../now.ts';
import { useSession } from '../stores/session.ts';

/**
 * One post's author line and text, for an annotation or a reply. Instructor posts and the
 * viewer's own posts are marked.
 */
const props = defineProps<{
  authorId: string;
  authorDisplayName: string;
  authorRole: Role;
  createdAt: string;
  text: string;
}>();

const now = useNow();
const session = useSession();
const isOwn = computed(() => props.authorId === session.user?.id);
</script>

<template>
  <div class="post" :class="{ instructor: authorRole === Role.Instructor }">
    <!-- The hidden commas keep the parts apart for screen readers and in copied text:
         "Sarah Kim, You, 2 hours ago". -->
    <div class="byline">
      <span class="author">{{ authorDisplayName }}</span>
      <template v-if="authorRole === Role.Instructor">
        <span class="visually-hidden">, </span>
        <span class="badge">Instructor</span>
      </template>
      <template v-if="isOwn">
        <span class="visually-hidden">, </span>
        <span class="badge own">You</span>
      </template>
      <span class="visually-hidden">, </span>
      <time class="muted" :datetime="createdAt" :title="exactTime(createdAt)">
        {{ relativeTime(createdAt, now) }}
      </time>
    </div>
    <p class="text">{{ text }}</p>
  </div>
</template>

<style scoped>
.post {
  padding: var(--space-2) var(--space-3);
}

/* A tinted edge as well as the badge, so the marking doesn't rely on color alone. */
.post.instructor {
  border-left: 3px solid var(--color-accent);
  border-radius: 0;
  background: var(--color-instructor);
}

.byline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 0.875rem;
}

.author {
  font-weight: 600;
}

.badge {
  padding: 0 var(--space-2);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-instructor-text);
  font-size: 0.75rem;
}

/* Outlined rather than filled, so it differs from the instructor badge in shape, not just color. */
.badge.own {
  border: 1px solid var(--color-text-muted);
  background: transparent;
  color: var(--color-text-muted);
}

/* Keeps the line breaks people typed. */
.text {
  margin: var(--space-1) 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
