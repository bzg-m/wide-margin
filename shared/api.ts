/** The roles a user can have. */
export const Role = { Student: 'student', Instructor: 'instructor' } as const;
/** One of the values of `Role`. */
export type Role = (typeof Role)[keyof typeof Role];

/** A user, as returned by the API. */
export type User = { id: string; displayName: string; role: Role };

/** A reading with its discussion counts, as returned by the API. */
export type Reading = {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  createdAt: string;
  threadCount: number;
  replyCount: number;
  /** Distinct students who have posted. Present only for users allowed to view participation. */
  participatingStudentCount?: number;
  /** When the newest post was made, or null if there are none. */
  lastActivityAt: string | null;
};

/** One page of users. */
export type ListUsersResponse = { users: User[]; nextPageToken?: string };

/** One page of readings. */
export type ListReadingsResponse = { readings: Reading[]; nextPageToken?: string };
