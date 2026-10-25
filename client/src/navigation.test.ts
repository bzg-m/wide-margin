import { describe, expect, it } from 'vitest';
import { Role, type User } from '../../shared/api.ts';
import { afterSignIn, allowOrRedirect, RouteName } from './navigation.ts';

const student: User = { id: '1', displayName: 'Sam', role: Role.Student };

describe('afterSignIn', () => {
  it("won't follow a redirect to another site", () => {
    expect(afterSignIn({ redirect: '//attacker.example/page' })).toEqual({
      name: RouteName.Readings,
    });
    expect(afterSignIn({ redirect: 'https://attacker.example' })).toEqual({
      name: RouteName.Readings,
    });
  });
});

describe('allowOrRedirect', () => {
  it('sends signed-out visitors to sign in, remembering where they were going', () => {
    const to = { name: RouteName.Reading, fullPath: '/readings/3', query: {} };

    expect(allowOrRedirect(to, null)).toEqual({
      name: RouteName.SignIn,
      query: { redirect: '/readings/3' },
    });
  });

  it('sends signed-in users from sign in to where they were going', () => {
    const to = {
      name: RouteName.SignIn,
      fullPath: '/sign-in?redirect=/readings/3',
      query: { redirect: '/readings/3' },
    };

    expect(allowOrRedirect(to, student)).toBe('/readings/3');
  });

  it('sends signed-in users from sign in to the readings when there is nowhere else to go', () => {
    const to = { name: RouteName.SignIn, fullPath: '/sign-in', query: {} };

    expect(allowOrRedirect(to, student)).toEqual({ name: RouteName.Readings });
  });

  it('lets a signed-in user open a page', () => {
    const to = { name: RouteName.Reading, fullPath: '/readings/3', query: {} };

    expect(allowOrRedirect(to, student)).toBe(true);
  });
});
