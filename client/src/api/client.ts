import type { FieldError, Problem } from '../../../shared/problem.ts';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;
const UNREACHABLE = "Can't reach the server.";
// What a proxy answers when the server behind it is down or not answering.
const GATEWAY_STATUSES = [502, 503, 504];

/** A failed API request. */
export class ApiError extends Error {
  /** The HTTP status, or 0 when no response arrived at all. */
  readonly status: number;
  /** Problems with specific request fields, as reported by the server. */
  readonly fieldErrors: FieldError[];
  /** True when the server couldn't be reached, rather than answering with an error. */
  readonly serverUnreachable: boolean;

  constructor(
    status: number,
    message: string,
    {
      fieldErrors = [],
      serverUnreachable = false,
    }: { fieldErrors?: FieldError[]; serverUnreachable?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.serverUnreachable = serverUnreachable;
  }
}

/** True if the error means the server couldn't be reached, which the status area already shows. */
export function isServerUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.serverUnreachable;
}

/** Options for one API request. */
export type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Sent as the Idempotency-Key header, unchanged on every retry. */
  idempotencyKey?: string;
  /** Whether repeating the request is safe. Defaults to true for GETs and for requests with an idempotency key. */
  retry?: boolean;
};

/** What the client needs from outside, and who it tells about the connection. Tests replace these. */
export type ApiDependencies = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  /** Called after each request: false when the server couldn't be reached, true when it answered. */
  onServerReachable?: (reachable: boolean) => void;
};

/** The real implementations, used unless a caller passes its own. */
export const defaultDependencies: ApiDependencies = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
};

/** An API client, as made by `createApiClient`. */
export type ApiClient = ReturnType<typeof createApiClient>;

// A factory function whose returned functions share `deps` through a closure, rather than a
// class: the same style as Vue composables and Pinia setup stores.

/** Creates an API client. Requests go to /v1 on the page's own origin. */
export function createApiClient(deps: ApiDependencies = defaultDependencies) {
  /**
   * Sends a request and returns the parsed JSON response. Retries network errors, 5xx and 429
   * responses up to three times when repeating is safe; throws ApiError otherwise.
   */
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const canRetry = options.retry ?? (method === 'GET' || options.idempotencyKey !== undefined);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    const init: RequestInit = {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    };

    for (let attempt = 0; ; attempt++) {
      const response = await deps.fetch(`/v1${path}`, init).catch(() => undefined);
      const failedTemporarily = !response || response.status >= 500 || response.status === 429;
      if (failedTemporarily && canRetry && attempt < MAX_RETRIES) {
        await deps.sleep(delayBefore(attempt, response));
        continue;
      }
      if (!response) {
        deps.onServerReachable?.(false);
        throw new ApiError(0, UNREACHABLE, { serverUnreachable: true });
      }
      if (!response.ok) {
        const error = await toApiError(response);
        deps.onServerReachable?.(!error.serverUnreachable);
        throw error;
      }
      deps.onServerReachable?.(true);
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
  }

  /**
   * Fetches every page of a list and returns all its items. Each page is retried like any GET;
   * if one still fails, its ApiError is thrown and no partial list is returned.
   */
  async function listAll<T>(path: string, field: string): Promise<T[]> {
    const items: T[] = [];
    let pageToken: string | undefined;
    do {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
      const page = await request<Record<string, unknown>>(`${path}${query}`);
      items.push(...(page[field] as T[]));
      pageToken = page.nextPageToken as string | undefined;
    } while (pageToken);
    return items;
  }

  // Doubles each time, with some randomness so that many clients don't retry in step.
  // A Retry-After header given in seconds takes precedence.
  function delayBefore(attempt: number, response: Response | undefined): number {
    const retryAfterSeconds = Number(response?.headers.get('Retry-After'));
    if (retryAfterSeconds > 0) return Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS);
    return BASE_DELAY_MS * 2 ** attempt * (0.5 + deps.random() / 2);
  }

  return { request, listAll };
}

// A Problem Details body gives the message. Without one, a gateway status means the server
// behind a proxy couldn't be reached.
async function toApiError(response: Response): Promise<ApiError> {
  const problem = (await response.json().catch(() => undefined)) as Problem | undefined;
  const message = problem?.detail ?? problem?.title;
  if (message) return new ApiError(response.status, message, { fieldErrors: problem?.errors });
  if (GATEWAY_STATUSES.includes(response.status)) {
    return new ApiError(response.status, UNREACHABLE, { serverUnreachable: true });
  }
  return new ApiError(response.status, `The request failed (${response.status}).`);
}
