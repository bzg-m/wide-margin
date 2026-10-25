<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Role, type Reading } from '../../../shared/api.ts';
import { Action, can } from '../../../shared/permissions.ts';
import { isServerUnreachable, isShownInStatusArea } from '../api/client.ts';
import { listUsers } from '../api/index.ts';
import NewReadingPanel from '../components/NewReadingPanel.vue';
import ReadingsTable from '../components/ReadingsTable.vue';
import { defaultSort, nextSort, sortReadings, SortKey, type Sort } from '../readings.ts';
import { useReadings } from '../stores/readings.ts';
import { useSession } from '../stores/session.ts';

const session = useSession();
const readings = useReadings();
const route = useRoute();
const router = useRouter();

const canCreate = computed(() => !!session.user && can(session.user, Action.CreateReading));
const canSeeParticipation = computed(
  () => !!session.user && can(session.user, Action.ViewParticipation),
);

const sort = ref<Sort>(defaultSort);
const sorted = computed(() => sortReadings(readings.items, sort.value));
const studentCount = ref<number | null>(null);

const loading = ref(false);
const loadError = ref('');
// A lost connection is shown in the status area, so this page only notes that it's waiting.
const waitingForServer = ref(false);
const confirmation = ref('');

// The panel is open while the URL has ?new, so on a phone the back button closes it.
const panelOpen = computed(() => 'new' in route.query);

// For the phone layout, where column headers give way to a menu.
const sortChoices = computed(() => [
  { label: 'Newest', sort: { key: SortKey.Created, descending: true } },
  { label: 'Recent activity', sort: { key: SortKey.LastActivity, descending: true } },
  { label: 'Most annotations', sort: { key: SortKey.Annotations, descending: true } },
  ...(canSeeParticipation.value
    ? [{ label: 'Most students', sort: { key: SortKey.Students, descending: true } }]
    : []),
  { label: 'Title A to Z', sort: { key: SortKey.Title, descending: false } },
]);
const sortChoice = computed({
  get: () =>
    sortChoices.value.findIndex(
      (c) => c.sort.key === sort.value.key && c.sort.descending === sort.value.descending,
    ),
  set: (index: number) => {
    sort.value = sortChoices.value[index].sort;
  },
});

async function load() {
  loading.value = !readings.loaded;
  loadError.value = '';
  waitingForServer.value = false;
  try {
    await readings.refresh();
    if (canSeeParticipation.value && studentCount.value === null) {
      studentCount.value = (await listUsers()).filter((u) => u.role === Role.Student).length;
    }
  } catch (error) {
    if (isServerUnreachable(error)) waitingForServer.value = true;
    else if (!isShownInStatusArea(error))
      loadError.value = error instanceof Error ? error.message : 'Readings failed to load.';
  } finally {
    loading.value = false;
  }
}

function openPanel() {
  confirmation.value = '';
  void router.push({ query: { new: null } });
}

function closePanel() {
  void router.replace({ query: {} });
}

function created(reading: Reading) {
  readings.add(reading);
  // Refresh too: if an earlier send reached the server before the connection dropped, it
  // shows up now. If the refresh fails, the list simply keeps what it has.
  readings.refresh().catch(() => {});
  // The default sort puts the new reading first, where it can be seen.
  sort.value = defaultSort;
  confirmation.value = `Created “${reading.title}”.`;
  closePanel();
}

onMounted(load);
</script>

<template>
  <div class="readings-page" :class="{ 'panel-open': panelOpen }">
    <div class="list-column">
      <div class="page-heading">
        <h1>Readings</h1>
        <button v-if="canCreate" type="button" class="button primary" @click="openPanel">
          New reading
        </button>
      </div>
      <p class="confirmation" aria-live="polite">{{ confirmation }}</p>

      <p v-if="loading" class="muted">Loading readings…</p>
      <p v-else-if="loadError" class="error">
        {{ loadError }}
        <button type="button" class="button" @click="load">Retry</button>
      </p>
      <p v-else-if="waitingForServer && readings.items.length === 0" class="muted">
        Readings will appear once the server is reachable.
      </p>
      <template v-else-if="readings.items.length === 0">
        <div v-if="canCreate" class="empty">
          <h2>Create your first reading</h2>
          <p class="muted">Readings you add appear here for students to discuss.</p>
        </div>
        <p v-else class="muted">No readings have been assigned yet.</p>
      </template>
      <template v-else>
        <label class="sort-menu">
          Sort by
          <select v-model.number="sortChoice">
            <option v-for="(choice, index) in sortChoices" :key="choice.label" :value="index">
              {{ choice.label }}
            </option>
          </select>
        </label>
        <ReadingsTable
          :readings="sorted"
          :sort="sort"
          :show-participation="canSeeParticipation"
          :student-count="studentCount"
          @sort="(key) => (sort = nextSort(sort, key))"
        />
      </template>
    </div>

    <NewReadingPanel
      v-if="panelOpen && canCreate"
      class="panel-column"
      @created="created"
      @cancel="closePanel"
    />
  </div>
</template>

<style scoped>
.readings-page {
  display: grid;
  gap: var(--space-6);
  align-items: start;
}

.readings-page.panel-open {
  grid-template-columns: minmax(0, 1fr) 22rem;
}

.panel-column {
  position: sticky;
  top: var(--space-4);
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.page-heading h1 {
  margin: 0;
}

.confirmation {
  min-height: 1.5em;
  margin: var(--space-2) 0;
  color: var(--color-text-muted);
}

.empty {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}

/* The table's layout follows this column's width, which shrinks when the panel opens. */
.list-column {
  container-type: inline-size;
}

.sort-menu {
  display: none;
}

/* On narrow screens, the form replaces the list while it's open. */
@media (max-width: 640px) {
  .readings-page.panel-open {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel-open .list-column {
    display: none;
  }

  .panel-column {
    position: static;
  }
}

/* When the list is narrow, rows become cards (see ReadingsTable) and sorting moves to a menu. */
@container (max-width: 640px) {
  .sort-menu {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .sort-menu select {
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
  }
}
</style>
