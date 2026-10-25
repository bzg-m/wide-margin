import type {
  ListReadingsResponse,
  ListUsersResponse,
  Reading,
  User,
} from '../../../shared/api.ts';
import type { CreateReadingBody } from '../../../shared/schemas.ts';
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
