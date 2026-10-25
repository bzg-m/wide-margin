<script setup lang="ts">
import { useStatus } from '../stores/status.ts';

/** Shows the most important problem that no user action caused, if any, with an optional Retry. */
const status = useStatus();
</script>

<template>
  <div class="status-area" aria-live="polite">
    <div v-if="status.current" class="status-message">
      <span>{{ status.current.message }}</span>
      <button
        v-if="status.current.retry"
        type="button"
        class="button"
        @click="status.current.retry"
      >
        Retry
      </button>
    </div>
  </div>
</template>

<style scoped>
.status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--color-warning);
  color: var(--color-warning-text);
}
</style>
