<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Reading } from '../../../shared/api.ts';
import { RouteName } from '../navigation.ts';

/** A reading's title, description and counts, shown beside its discussion. */
const props = defineProps<{
  reading: Reading;
  /** Whether to show how many students have participated. */
  showParticipation: boolean;
  /** How many students are in the class; null while unknown. */
  studentCount: number | null;
}>();

// On narrow layouts a long description starts cut short, with a button to show the rest.
const LONG_DESCRIPTION = 240;
const expanded = ref(false);
const isLong = computed(() => props.reading.description.length > LONG_DESCRIPTION);

const annotations = computed(() => props.reading.threadCount + props.reading.replyCount);
const participation = computed(() => {
  const count = props.reading.participatingStudentCount ?? 0;
  const of = props.studentCount === null ? '' : ` of ${props.studentCount}`;
  return `${count}${of} students participating`;
});
</script>

<template>
  <section class="details">
    <RouterLink :to="{ name: RouteName.Readings }" class="back">← Readings</RouterLink>
    <h1 class="title">{{ reading.title }}</h1>
    <p class="description" :class="{ clamped: isLong && !expanded }">{{ reading.description }}</p>
    <button v-if="isLong" type="button" class="show-more" @click="expanded = !expanded">
      {{ expanded ? 'Show less' : 'Show more' }}
    </button>
    <dl class="counts">
      <div>
        <dt>{{ annotations }} annotations</dt>
        <dd class="muted">{{ reading.threadCount }} threads · {{ reading.replyCount }} replies</dd>
      </div>
      <div v-if="showParticipation">
        <dt>{{ participation }}</dt>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: var(--space-3);
  font-size: 0.875rem;
}

.title {
  font-family: var(--font-serif);
  font-weight: 500;
}

.description {
  margin: 0;
  white-space: pre-wrap;
}

.show-more {
  display: none;
  min-height: 44px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-accent);
}

.counts {
  margin: var(--space-4) 0 0;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.counts div + div {
  margin-top: var(--space-2);
}

dt {
  font-weight: 500;
}

dd {
  margin: 0;
  font-size: 0.875rem;
}

/* The page makes this a container; when it's narrow, long descriptions start cut short. */
@container (max-width: 760px) {
  .description.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .show-more {
    display: inline;
  }
}
</style>
