<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue';
import type { Reading } from '../../../shared/api.ts';
import {
  createReadingBody,
  limits,
  toFieldErrors,
  type CreateReadingBody,
} from '../../../shared/schemas.ts';
import { characterCount } from '../../../shared/text.ts';
import { ApiError, isShownInStatusArea } from '../api/client.ts';
import { createReading } from '../api/index.ts';
import { attemptFor, type Attempt } from '../idempotency.ts';
import { useDrafts } from '../stores/drafts.ts';

/** A form for creating a reading, shown beside the readings list. */
const emit = defineEmits<{ created: [reading: Reading]; cancel: [] }>();

const DRAFT_KEY = 'reading:new';

// The fields live in a draft, so leaving the page (for example, to sign in again) keeps them.
const drafts = useDrafts();
const draft = drafts.draftFor(DRAFT_KEY);
const title = computed({
  get: () => draft.fields.title ?? '',
  set: (value: string) => (draft.fields.title = value),
});
const description = computed({
  get: () => draft.fields.description ?? '',
  set: (value: string) => (draft.fields.description = value),
});
const fieldErrors = ref<Record<string, string>>({});
const formError = ref('');
const sending = ref(false);
// The draft keeps the last unsuccessful send; sending the same content again reuses its key.
// TODO: if a send failed with an unknown outcome (the connection was lost) and the user edits
// before sending again, the earlier version may also have been saved, leaving two readings.
// Once readings can be edited, offer to apply the changes to the saved one instead.
const titleInput = useTemplateRef<HTMLInputElement>('title-input');
const descriptionInput = useTemplateRef<HTMLTextAreaElement>('description-input');
onMounted(() => titleInput.value?.focus());

// Focus goes to the first field with an error, so a screen reader reads that error, which the
// field points to with aria-describedby.
async function showFieldErrors(errors: Record<string, string>) {
  fieldErrors.value = errors;
  await nextTick();
  if (errors.title) titleInput.value?.focus();
  else if (errors.description) descriptionInput.value?.focus();
}

// Counters appear as a field nears its limit, rather than all the time.
const titleCount = computed(() => characterCount(title.value));
const descriptionCount = computed(() => characterCount(description.value));
const nearLimit = (count: number, limit: number) => count > limit * 0.8;

async function submit() {
  if (sending.value) return;
  fieldErrors.value = {};
  formError.value = '';
  const parsed = createReadingBody.safeParse({
    title: title.value,
    description: description.value,
  });
  if (!parsed.success) {
    void showFieldErrors(
      Object.fromEntries(toFieldErrors(parsed.error).map((e) => [e.field, e.message])),
    );
    return;
  }
  sending.value = true;
  const attempt = attemptFor(
    parsed.data,
    draft.lastAttempt as Attempt<CreateReadingBody> | undefined,
  );
  draft.lastAttempt = attempt;
  try {
    const reading = await createReading(attempt.body, attempt.key);
    drafts.clear(DRAFT_KEY);
    emit('created', reading);
  } catch (error) {
    // The status area shows lost connections and ended sign-ins; the draft stays for another try.
    if (isShownInStatusArea(error)) return;
    if (error instanceof ApiError && error.fieldErrors.length > 0) {
      void showFieldErrors(Object.fromEntries(error.fieldErrors.map((e) => [e.field, e.message])));
    } else {
      formError.value =
        error instanceof Error ? error.message : 'The reading could not be created.';
    }
  } finally {
    sending.value = false;
  }
}

/** Closes the form and throws away what was typed. */
function discard() {
  drafts.clear(DRAFT_KEY);
  emit('cancel');
}
</script>

<template>
  <section class="panel" aria-labelledby="new-reading-heading">
    <div class="panel-heading">
      <h2 id="new-reading-heading">New reading</h2>
      <button type="button" class="close" aria-label="Close" @click="discard">×</button>
    </div>
    <form novalidate @submit.prevent="submit">
      <label for="reading-title">Title</label>
      <input
        id="reading-title"
        ref="title-input"
        v-model="title"
        class="field"
        :aria-invalid="!!fieldErrors.title"
        :aria-describedby="fieldErrors.title ? 'reading-title-error' : undefined"
      />
      <p v-if="nearLimit(titleCount, limits.readingTitle)" class="counter muted">
        {{ titleCount }} / {{ limits.readingTitle }}
      </p>
      <p v-if="fieldErrors.title" id="reading-title-error" class="error">{{ fieldErrors.title }}</p>

      <label for="reading-description">Description</label>
      <textarea
        id="reading-description"
        ref="description-input"
        v-model="description"
        class="field"
        rows="5"
        placeholder="What students should read, and what to look for"
        :aria-invalid="!!fieldErrors.description"
        :aria-describedby="fieldErrors.description ? 'reading-description-error' : undefined"
      />
      <p v-if="nearLimit(descriptionCount, limits.readingDescription)" class="counter muted">
        {{ descriptionCount }} / {{ limits.readingDescription }}
      </p>
      <p v-if="fieldErrors.description" id="reading-description-error" class="error">
        {{ fieldErrors.description }}
      </p>

      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <div class="actions">
        <button type="submit" class="button primary">
          {{ sending ? 'Creating…' : 'Create reading' }}
        </button>
        <button type="button" class="button" @click="discard">Cancel</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.panel {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close {
  min-width: 44px;
  min-height: 44px;
  border: none;
  background: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
}

label {
  display: block;
  margin-top: var(--space-4);
  margin-bottom: var(--space-1);
  font-weight: 500;
}

.field {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-field-border);
  border-radius: var(--radius);
  background: var(--color-page);
  color: var(--color-text);
  font: inherit;
}

.field[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.counter,
.error {
  margin: var(--space-1) 0 0;
  font-size: 0.875rem;
}

.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
</style>
