<script setup lang="ts">
import { computed } from 'vue';
import type { Reading } from '../../../shared/api.ts';
import { countOf, exactTime, relativeTime } from '../format.ts';
import { useNow } from '../now.ts';
import { RouteName } from '../navigation.ts';
import { postCount, SortKey, type Sort } from '../readings.ts';

/** The readings as a table with sortable column headers. In a narrow container, each row becomes a card. */
const props = defineProps<{
  readings: Reading[];
  sort: Sort;
  /** Whether to show the students-participating column. */
  showParticipation: boolean;
  /** How many students are in the class, for "5 of 12"; null while unknown. */
  studentCount: number | null;
}>();

const emit = defineEmits<{ sort: [key: SortKey] }>();
const now = useNow();

const columns = computed(() => [
  { key: SortKey.Title, label: 'Title' },
  { key: SortKey.Annotations, label: 'Annotations' },
  ...(props.showParticipation ? [{ key: SortKey.Students, label: 'Students' }] : []),
  { key: SortKey.Created, label: 'Created' },
  { key: SortKey.LastActivity, label: 'Last activity' },
]);

function ariaSort(key: SortKey) {
  if (props.sort.key !== key) return 'none';
  return props.sort.descending ? 'descending' : 'ascending';
}

function participation(reading: Reading) {
  const count = reading.participatingStudentCount ?? 0;
  return props.studentCount === null ? String(count) : `${count} of ${props.studentCount}`;
}
</script>

<template>
  <table class="readings-table">
    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.key"
          scope="col"
          :aria-sort="ariaSort(column.key)"
        >
          <button type="button" class="sort-button" @click="emit('sort', column.key)">
            {{ column.label }}
            <span v-if="sort.key === column.key" aria-hidden="true">
              {{ sort.descending ? '↓' : '↑' }}
            </span>
          </button>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="reading in readings" :key="reading.id">
        <td class="title-cell">
          <RouterLink
            :to="{ name: RouteName.Reading, params: { readingId: reading.id } }"
            class="reading-title"
          >
            {{ reading.title }}
          </RouterLink>
          <span class="description muted">{{ reading.description }}</span>
        </td>
        <td data-label="Annotations">
          {{ reading.annotationCount }}
          <span class="split muted">
            {{ countOf(reading.replyCount, 'reply', 'replies') }} ·
            {{ countOf(postCount(reading), 'post', 'posts') }}
          </span>
        </td>
        <td v-if="showParticipation" data-label="Students">{{ participation(reading) }}</td>
        <td data-label="Created">
          <time :datetime="reading.createdAt" :title="exactTime(reading.createdAt)">
            {{ relativeTime(reading.createdAt, now) }}
          </time>
        </td>
        <td data-label="Last activity">
          <time
            v-if="reading.lastActivityAt"
            :datetime="reading.lastActivityAt"
            :title="exactTime(reading.lastActivityAt)"
          >
            {{ relativeTime(reading.lastActivityAt, now) }}
          </time>
          <span v-else class="muted">None yet</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.readings-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

th,
td {
  padding: var(--space-3);
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--color-border);
}

th {
  font-weight: 500;
  white-space: nowrap;
}

.sort-button {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-text-muted);
  font-weight: inherit;
}

.title-cell {
  width: 45%;
}

.reading-title {
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  color: var(--color-text);
  text-decoration: none;
}

.reading-title:hover {
  text-decoration: underline;
}

.description {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.875rem;
}

.split {
  display: block;
  font-size: 0.8125rem;
}

/* In a narrow container, each row becomes a card and each value gets its column's label.
   The page sets the container, so this follows the list's width rather than the window's. */
@container (max-width: 640px) {
  .readings-table,
  .readings-table tbody,
  .readings-table tr,
  .readings-table td {
    display: block;
  }

  .readings-table {
    border: none;
    background: none;
  }

  thead {
    display: none;
  }

  tr {
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  td {
    padding: var(--space-1) 0;
    border: none;
  }

  /* On a card, the title is the way into the reading, so it gets a full-size tap target. */
  .reading-title {
    display: flex;
    align-items: center;
    min-height: 44px;
  }

  .title-cell {
    width: auto;
    padding-bottom: var(--space-2);
  }

  td[data-label]::before {
    content: attr(data-label) ': ';
    color: var(--color-text-muted);
  }

  .split {
    display: inline;
    margin-left: var(--space-2);
  }
}
</style>
