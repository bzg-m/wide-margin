import { describe, expect, it } from 'vitest';
import { Role, type User } from './api.ts';
import { Action, can } from './permissions.ts';

const student: User = { id: '1', displayName: 'Sam', role: Role.Student };
const instructor: User = { id: '2', displayName: 'Ines', role: Role.Instructor };

describe('can', () => {
  it.each(Object.values(Action))('reserves %s for instructors', (action) => {
    expect(can(instructor, action)).toBe(true);
    expect(can(student, action)).toBe(false);
  });
});
