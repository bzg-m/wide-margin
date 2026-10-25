import {
  Role,
  type Annotation,
  type ListAnnotationsResponse,
  type ListReadingsResponse,
  type ListRepliesResponse,
  type ListUsersResponse,
  type Reading,
  type Reply,
  type User,
} from '../../../shared/api.ts';
import type { CreatePostBody, CreateReadingBody } from '../../../shared/schemas.ts';
import { Priority, useStatus } from '../stores/status.ts';
import { createApiClient, defaultDependencies } from './client.ts';

const SERVER_PROBLEM = 'server';

// Set by the app shell, which has the router and stores the response needs. A setter keeps this
// file from importing them, since they import this file.
let unauthorizedHandler = () => {};

/** Sets what happens when a request finds that the user is no longer signed in. */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

/**
 * The app's API client. Every request keeps the status area's "Can't reach the server" current:
 * a request that can't reach the server reports it, and any answer from the server clears it.
 */
export const api = createApiClient({
  ...defaultDependencies,
  onServerReachable: (reachable) => {
    const status = useStatus();
    if (reachable) {
      status.resolve(SERVER_PROBLEM);
      return;
    }
    status.report({
      id: SERVER_PROBLEM,
      message: "Can't reach the server.",
      priority: Priority.Server,
      // Reloading reruns whatever failed, from the sign-in check to the page's own data.
      action: { label: 'Retry', run: () => window.location.reload() },
    });
  },
  onUnauthorized: () => unauthorizedHandler(),
});

/** The signed-in user. Throws ApiError with status 401 if nobody is signed in. */
export const getSession = () => api.request<User>('/session');

/** Signs in as the user and returns them. */
export const signIn = (userId: string) =>
  api.request<User>('/session', { method: 'POST', body: { userId }, retry: true });

/** Signs the current user out. */
export const signOut = () => api.request<void>('/session', { method: 'DELETE', retry: true });

/** Every user, for the identity picker. */
export const listUsers = () =>
  api.listAll<User>('/users', 'users' satisfies keyof ListUsersResponse);

/** Every reading, newest first. */
export const listReadings = () =>
  api.listAll<Reading>('/readings', 'readings' satisfies keyof ListReadingsResponse);

/** Creates a reading. The same idempotency key must be used for every attempt at one draft. */
export const createReading = (body: CreateReadingBody, idempotencyKey: string) =>
  api.request<Reading>('/readings', { method: 'POST', body, idempotencyKey });

/** How many students are in the class, for "5 of 12 students participating". */
export async function countStudents(): Promise<number> {
  return (await listUsers()).filter((user) => user.role === Role.Student).length;
}

// IDs come from the URL, so they're encoded before going into a request path.
const readingPath = (readingId: string) => `/readings/${encodeURIComponent(readingId)}`;
const annotationsPath = (readingId: string) => `${readingPath(readingId)}/annotations`;
const repliesPath = (readingId: string, annotationId: string) =>
  `${annotationsPath(readingId)}/${encodeURIComponent(annotationId)}/replies`;

/** One reading, with its counts. */
export const getReading = (readingId: string) => api.request<Reading>(readingPath(readingId));

/** Every annotation on a reading, newest first. */
export const listAnnotations = (readingId: string) =>
  api.listAll<Annotation>(
    annotationsPath(readingId),
    'annotations' satisfies keyof ListAnnotationsResponse,
  );

/** Every reply to an annotation, oldest first. */
export const listReplies = (readingId: string, annotationId: string) =>
  api.listAll<Reply>(
    repliesPath(readingId, annotationId),
    'replies' satisfies keyof ListRepliesResponse,
  );

/** Posts an annotation. The same idempotency key must be used for every attempt at one post. */
export const createAnnotation = (readingId: string, body: CreatePostBody, idempotencyKey: string) =>
  api.request<Annotation>(annotationsPath(readingId), { method: 'POST', body, idempotencyKey });

/** Replies to an annotation. The same idempotency key must be used for every attempt at one post. */
export const createReply = (
  readingId: string,
  annotationId: string,
  body: CreatePostBody,
  idempotencyKey: string,
) =>
  api.request<Reply>(repliesPath(readingId, annotationId), {
    method: 'POST',
    body,
    idempotencyKey,
  });
