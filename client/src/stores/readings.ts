import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Reading } from '../../../shared/api.ts';
import { listReadings } from '../api/index.ts';

/** The readings list. It's kept between visits, so returning shows the last list while it refreshes. */
export const useReadings = defineStore('readings', () => {
  const items = ref<Reading[]>([]);
  const loaded = ref(false);

  /** Fetches the full list, replacing what's held. */
  async function refresh(): Promise<void> {
    items.value = await listReadings();
    loaded.value = true;
  }

  /** Adds a reading just created at the top, unless the list already has it. */
  function add(reading: Reading): void {
    if (!items.value.some((r) => r.id === reading.id)) items.value = [reading, ...items.value];
  }

  return { items, loaded, refresh, add };
});
