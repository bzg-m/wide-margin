// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { Role, type Annotation } from '../../../shared/api.ts';
import AnnotationItem from './AnnotationItem.vue';

const annotation = (replyCount: number): Annotation => ({
  id: '10',
  readingId: '1',
  authorId: '2',
  authorDisplayName: 'Michael Reyes',
  authorRole: Role.Student,
  text: 'An annotation',
  createdAt: '2026-10-24T12:00:00.000Z',
  replyCount,
  lastActivityAt: '2026-10-24T12:00:00.000Z',
});

/** The reply toggle's visible text and the name screen readers use for it. */
function toggleOf(replyCount: number) {
  const item = mount(AnnotationItem, {
    props: { annotation: annotation(replyCount) },
    global: { plugins: [createPinia()] },
  });
  const toggle = item.get('button.toggle');
  return { visible: toggle.text(), name: toggle.attributes('aria-label') ?? '' };
}

describe('AnnotationItem', () => {
  it.each([0, 2])(
    "names the reply toggle after the annotation's author, starting with its visible text (%i replies)",
    (replyCount) => {
      const { visible, name } = toggleOf(replyCount);

      expect(name.startsWith(visible)).toBe(true);
      expect(name).toContain('Michael Reyes');
    },
  );
});
