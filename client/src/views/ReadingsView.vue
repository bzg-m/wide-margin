<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Reading } from '../../../shared/api.ts';
import { Action, can } from '../../../shared/permissions.ts';
import { isServerUnreachable, isShownInStatusArea } from '../api/client.ts';
import { countStudents } from '../api/index.ts';
import NewReadingPanel from '../components/NewReadingPanel.vue';
import ReadingsTable from '../components/ReadingsTable.vue';
import {
  defaultSort,
  nextSort,
  sortChoices,
  sortReadings,
  sortValue,
  type Sort,
} from '../readings.ts';
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

// However the panel closes (Cancel, Create or the back button), focus returns to the button that
// opened it, instead of being lost with the panel.
const newReadingButton = useTemplateRef<HTMLButtonElement>('new-reading-button');
watch(panelOpen, async (open, wasOpen) => {
  if (open || !wasOpen) return;
  await nextTick();
  newReadingButton.value?.focus();
});

// For the phone layout, where column headers give way to a menu.
const menuChoices = computed(() => sortChoices(canSeeParticipation.value));
const menuValue = computed({
  get: () => sortValue(sort.value),
  set: (value: string) => {
    const choice = menuChoices.value.find((c) => c.value === value);
    if (choice) sort.value = choice.sort;
  },
});

async function load() {
  loading.value = !readings.loaded;
  loadError.value = '';
  waitingForServer.value = false;
  try {
    await readings.refresh();
  } catch (error) {
    if (isServerUnreachable(error)) {
      waitingForServer.value = true;
    } else if (!isShownInStatusArea(error)) {
      loadError.value = error instanceof Error ? error.message : 'Readings failed to load.';
    }
  } finally {
    loading.value = false;
  }
  void loadStudentCount();
}

// The class size only adds "of 12" to the Students column, so if it fails to load, the list
// still shows, without it. A lost connection is shown in the status area.
async function loadStudentCount() {
  if (!canSeeParticipation.value || studentCount.value !== null) return;
  try {
    studentCount.value = await countStudents();
  } catch {
    // Leave it unknown.
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
        <button
          v-if="canCreate"
          ref="new-reading-button"
          type="button"
          class="button primary"
          @click="openPanel"
        >
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
          <select v-model="menuValue">
            <option v-for="choice in menuChoices" :key="choice.value" :value="choice.value">
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

  /* appearance: none lets Safari use these styles instead of its native look. That also removes
     the built-in arrow, so a small chevron is drawn with two gradients in the text color. */
  .sort-menu select {
    appearance: none;
    min-height: 44px;
    padding: 0 calc(var(--space-2) + 1.25rem) 0 var(--space-2);
    border: 1px solid var(--color-field-border);
    border-radius: var(--radius);
    background:
      linear-gradient(45deg, transparent 50%, currentColor 50%) right 14px center / 5px 5px
        no-repeat,
      linear-gradient(135deg, currentColor 50%, transparent 50%) right 9px center / 5px 5px
        no-repeat,
      var(--color-surface);
    color: var(--color-text);
    font: inherit;
  }
}
</style>
