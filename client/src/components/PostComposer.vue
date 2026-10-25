<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import {
  createPostBody,
  limits,
  toFieldErrors,
  type CreatePostBody,
} from '../../../shared/schemas.ts';
import { characterCount } from '../../../shared/text.ts';
import { ApiError, isShownInStatusArea } from '../api/client.ts';
import { attemptFor, type Attempt } from '../idempotency.ts';
import { useDrafts } from '../stores/drafts.ts';

/**
 * A multi-line box for posting an annotation or a reply. Its text is kept as a draft, so it survives
 * leaving the page; `send` is called with the cleaned text and an idempotency key.
 */
const props = defineProps<{
  /** Names this form's draft, such as "annotation:3" or "reply:17". */
  draftKey: string;
  /** Read by screen readers as the text box's name. */
  label: string;
  placeholder: string;
  send: (body: CreatePostBody, idempotencyKey: string) => Promise<unknown>;
}>();

const drafts = useDrafts();
// The draft key doesn't change for this component; the parent gives each form its own instance.
const draft = drafts.draftFor(props.draftKey);
const text = computed({
  get: () => draft.fields.text ?? '',
  set: (value: string) => (draft.fields.text = value),
});

const error = ref('');
const sending = ref(false);
const textBox = useTemplateRef<HTMLTextAreaElement>('text-box');
const count = computed(() => characterCount(text.value));
const shortcut = /Mac|iPhone|iPad/u.test(navigator.userAgent) ? '⌘+Enter' : 'Ctrl+Enter';

async function submit() {
  if (sending.value) return;
  error.value = '';
  const parsed = createPostBody.safeParse({ text: text.value });
  if (!parsed.success) {
    error.value = toFieldErrors(parsed.error)[0].message;
    return;
  }
  const attempt = attemptFor(parsed.data, draft.lastAttempt as Attempt<CreatePostBody> | undefined);
  draft.lastAttempt = attempt;
  sending.value = true;
  try {
    await props.send(attempt.body, attempt.key);
    drafts.clear(props.draftKey);
    textBox.value?.focus();
  } catch (failure) {
    // The status area shows lost connections and ended sign-ins; the text stays for another try.
    if (isShownInStatusArea(failure)) return;
    error.value =
      failure instanceof ApiError && failure.fieldErrors.length > 0
        ? failure.fieldErrors[0].message
        : failure instanceof Error
          ? failure.message
          : 'Posting failed.';
  } finally {
    sending.value = false;
  }
}

// Enter adds a line; Ctrl+Enter (or Cmd+Enter on a Mac) posts.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void submit();
  }
}
</script>

<template>
  <form class="composer" novalidate @submit.prevent="submit">
    <textarea
      ref="text-box"
      v-model="text"
      class="field"
      rows="3"
      :aria-label="label"
      :placeholder="placeholder"
      :aria-invalid="!!error"
      @keydown="onKeydown"
    />
    <div class="composer-footer">
      <span class="muted hint">{{ shortcut }} to post</span>
      <span v-if="count > limits.postText * 0.8" class="muted hint">
        {{ count }} / {{ limits.postText }}
      </span>
      <button type="submit" class="button primary">{{ sending ? 'Posting…' : 'Post' }}</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>

<style scoped>
.field {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-page);
  color: var(--color-text);
  font: inherit;
  resize: vertical;
}

.field[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.hint {
  font-size: 0.8125rem;
}

.hint:first-child {
  margin-right: auto;
}

.error {
  margin: var(--space-1) 0 0;
  font-size: 0.875rem;
}
</style>
