import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../../../shared/api.ts';
import { useDrafts } from './drafts.ts';
import { useSession } from './session.ts';

describe('drafts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSession().user = { id: '3', displayName: 'Sarah', role: Role.Student };
  });

  it("keeps a form's draft until it's cleared", () => {
    const drafts = useDrafts();
    drafts.draftFor('reply:1').fields.text = 'Half-written';

    expect(drafts.draftFor('reply:1').fields.text).toBe('Half-written');

    drafts.clear('reply:1');
    expect(drafts.draftFor('reply:1').fields.text).toBeUndefined();
  });

  it("keeps each user's drafts separate", () => {
    const drafts = useDrafts();
    const session = useSession();
    drafts.draftFor('reply:1').fields.text = "Sarah's reply";

    session.user = { id: '1', displayName: 'Dr. Lee', role: Role.Instructor };
    const otherUsersDraft = drafts.draftFor('reply:1').fields.text;
    session.user = { id: '3', displayName: 'Sarah', role: Role.Student };

    expect(otherUsersDraft).toBeUndefined();
    expect(drafts.draftFor('reply:1').fields.text).toBe("Sarah's reply");
  });
});
