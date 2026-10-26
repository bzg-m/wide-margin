// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../../../shared/api.ts';
import { useSession } from '../stores/session.ts';
import PostContent from './PostContent.vue';

/** Mounts a post by the given author, as seen by the signed-in user. */
function mountPost(authorId: string) {
  return mount(PostContent, {
    props: {
      authorId,
      authorDisplayName: 'Sam',
      authorRole: Role.Student,
      createdAt: '2026-10-24T12:00:00.000Z',
      text: 'A post',
    },
  });
}

describe('PostContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSession().user = { id: '3', displayName: 'Sarah', role: Role.Student };
  });

  it("marks the viewer's own posts with a You badge, and nobody else's", () => {
    expect(mountPost('3').text()).toContain('You');
    expect(mountPost('2').text()).not.toContain('You');
  });

  it("keeps the byline's parts apart in its text, for screen readers and copying", () => {
    expect(mountPost('3').get('.byline').element.textContent).toMatch(/^Sam, You, \S/);
  });
});
