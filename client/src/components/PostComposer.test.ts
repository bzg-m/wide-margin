// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.ts';
import PostComposer from './PostComposer.vue';

/** Mounts a composer whose send calls the given fake. */
function mountComposer(send: (body: { text: string }, key: string) => Promise<unknown>) {
  return mount(PostComposer, {
    props: { draftKey: 'thread:1', label: 'Start a thread', placeholder: 'Say something', send },
    global: { plugins: [createPinia()] },
  });
}

describe('PostComposer', () => {
  it('posts with Ctrl+Enter and clears the box', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const composer = mountComposer(send);
    const textBox = composer.get('textarea');

    await textBox.setValue('  Why does this work?  ');
    await textBox.trigger('keydown', { key: 'Enter', ctrlKey: true });
    await flushPromises();

    expect(send).toHaveBeenCalledWith({ text: 'Why does this work?' }, expect.any(String));
    expect(textBox.element.value).toBe('');
  });

  it('keeps the text when sending fails', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(500, 'Something went wrong.'));
    const composer = mountComposer(send);
    const textBox = composer.get('textarea');

    await textBox.setValue('Half a thought');
    await composer.get('form').trigger('submit');
    await flushPromises();

    expect(textBox.element.value).toBe('Half a thought');
    expect(composer.get('[role="alert"]').text()).toBe('Something went wrong.');
  });

  it('reuses the idempotency key when retrying unchanged text', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'Something went wrong.'))
      .mockResolvedValueOnce(undefined);
    const composer = mountComposer(send);
    await composer.get('textarea').setValue('Try twice');

    await composer.get('form').trigger('submit');
    await flushPromises();
    await composer.get('form').trigger('submit');
    await flushPromises();

    const [[, firstKey], [, secondKey]] = send.mock.calls;
    expect(secondKey).toBe(firstKey);
  });
});
