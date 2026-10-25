<script setup lang="ts">
import { Role } from '../../../shared/api.ts';
import { exactTime, relativeTime } from '../format.ts';
import { useNow } from '../now.ts';

/** One post's author line and text, for an annotation or a reply. Instructor posts are marked. */
defineProps<{
  authorDisplayName: string;
  authorRole: Role;
  createdAt: string;
  text: string;
}>();

const now = useNow();
</script>

<template>
  <div class="post" :class="{ instructor: authorRole === Role.Instructor }">
    <div class="byline">
      <span class="author">{{ authorDisplayName }}</span>
      <span v-if="authorRole === Role.Instructor" class="badge">Instructor</span>
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

/* Keeps the line breaks people typed. */
.text {
  margin: var(--space-1) 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
