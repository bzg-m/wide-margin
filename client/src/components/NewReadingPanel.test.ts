// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import NewReadingPanel from './NewReadingPanel.vue';

describe('NewReadingPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves focus to the first field with an error, so its error is read', async () => {
    // Attached to the page, so focus can move.
    const panel = mount(NewReadingPanel, {
      attachTo: document.body,
      global: { plugins: [createPinia()] },
    });

    await panel.get('form').trigger('submit');
    await flushPromises();
    const afterEmptySubmit = document.activeElement?.id;

    await panel.get('#reading-title').setValue('A title');
    await panel.get('form').trigger('submit');
    await flushPromises();

    expect(afterEmptySubmit).toBe('reading-title');
    expect(document.activeElement?.id).toBe('reading-description');
    expect(panel.get('#reading-description').attributes('aria-describedby')).toBe(
      'reading-description-error',
    );
  });
});
