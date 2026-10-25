import { Role, type User } from './api.ts';

/** Things a user may try to do. */
export const Action = {
  CreateReading: 'createReading',
  ViewParticipation: 'viewParticipation',
  /**
   * Show every reply on a reading at once. This shapes the interface rather than restricting
   * data: anyone can read every reply, so the server doesn't check it.
   */
  ReviewDiscussion: 'reviewDiscussion',
} as const;
/** One of the values of `Action`. */
export type Action = (typeof Action)[keyof typeof Action];

/** Whether the user may perform the action. Every permission rule lives here. */
export function can(user: User, action: Action): boolean {
  switch (action) {
    case Action.CreateReading:
    case Action.ViewParticipation:
    case Action.ReviewDiscussion:
      return user.role === Role.Instructor;
    default: {
      // A compile error here means an action was added without a rule.
      const unhandled: never = action;
      throw new Error(`No permission rule for ${unhandled}`);
    }
  }
}
