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

/** An annotation, which starts a thread on a reading, as returned by the API. */
export type Annotation = {
  id: string;
  readingId: string;
  authorId: string;
  authorDisplayName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
  replyCount: number;
  /** When the newest reply was posted, or when the annotation was if it has no replies. */
  lastActivityAt: string;
};

/** A reply to an annotation, as returned by the API. */
export type Reply = {
  id: string;
  annotationId: string;
  readingId: string;
  authorId: string;
  authorDisplayName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
};

/** One page of annotations. */
export type ListAnnotationsResponse = { annotations: Annotation[]; nextPageToken?: string };

/** One page of replies. */
export type ListRepliesResponse = { replies: Reply[]; nextPageToken?: string };

/** How often the server sends a heartbeat on a quiet event stream. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Names of the events sent on a reading's event stream. */
export const EventName = {
  /** Sent once the stream is listening; anything posted afterwards will arrive. */
  Ready: 'ready',
  /** Sent every HEARTBEAT_INTERVAL_MS, so the client can tell a quiet stream from a dead one. */
  Heartbeat: 'heartbeat',
  AnnotationCreated: 'annotation.created',
  ReplyCreated: 'reply.created',
} as const;

/** An event about a reading, as sent on its event stream. */
export type ReadingEvent =
  | { name: typeof EventName.AnnotationCreated; data: Annotation }
  | { name: typeof EventName.ReplyCreated; data: Reply };
