import { describe, expect, it } from 'vitest';
import { Role, type User } from '../../shared/api.ts';
import { allowOrRedirect, RouteName } from './navigation.ts';

const student: User = { id: '1', displayName: 'Sam', role: Role.Student };

describe('allowOrRedirect', () => {
  it('sends signed-out visitors to sign in, remembering where they were going', () => {
    const to = { name: RouteName.Reading, fullPath: '/readings/3' };

    expect(allowOrRedirect(to, null)).toEqual({
      name: RouteName.SignIn,
      query: { redirect: '/readings/3' },
    });
  });

  it('sends signed-in users away from sign in', () => {
    const to = { name: RouteName.SignIn, fullPath: '/sign-in' };

    expect(allowOrRedirect(to, student)).toEqual({ name: RouteName.Readings });
  });

  it('lets a signed-in user open a page', () => {
    const to = { name: RouteName.Reading, fullPath: '/readings/3' };

    expect(allowOrRedirect(to, student)).toBe(true);
  });
});
