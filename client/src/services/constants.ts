/**
 * Two base URLs, deliberately.
 *
 * Auth always runs against our own backend. The *data* source is switchable and defaults
 * to the Star Wars API, because requirement 6 names that URL literally. A consequence is
 * that the bearer token is only sent to SERVER_BASE_URL — never to SWAPI, which is a
 * third party and has no business receiving our credentials. See plan/auth.md.
 */
export const SERVER_BASE_URL =
  import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3001/api';

export const DATA_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://swapi.py4e.com/api';

export const REQUEST_TIMEOUT_MS = 10_000;

/** Fixed by the API, not by us. */
export const PAGE_SIZE = 10;
