import type { AuthUser, LoginResponse } from '@/types';

import { SERVER_BASE_URL } from './constants';

/**
 * The access token lives here — a module variable, never `localStorage`. Anything in web
 * storage is a usable bearer credential for any script on the origin; this dies with the
 * tab, and the httpOnly refresh cookie carries the long-lived half. See plan/auth.md.
 */
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

export class AuthRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AuthRequestError';
    this.code = code;
    this.status = status;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

const readError = async (response: Response): Promise<AuthRequestError> => {
  const body = (await response.json().catch(() => ({}))) as ErrorEnvelope;

  return new AuthRequestError(
    body.error?.code ?? 'UNKNOWN',
    response.status,
    body.error?.message ?? 'Request failed.',
  );
};

/** `credentials: 'include'` is what carries the refresh cookie cross-origin. */
const postToAuth = async (path: string, body?: unknown): Promise<Response> =>
  fetch(`${SERVER_BASE_URL}/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });

const readTokens = async (response: Response): Promise<AuthUser> => {
  if (!response.ok) {
    accessToken = null;
    throw await readError(response);
  }

  const payload = (await response.json()) as LoginResponse;
  accessToken = payload.accessToken;

  return payload.user;
};

export const login = async (username: string, password: string): Promise<AuthUser> =>
  readTokens(await postToAuth('login', { username, password }));

/**
 * Shared in-flight promise. Concurrent 401s would otherwise start several refreshes, and
 * rotation invalidates all but one — signing the user out in the middle of a *successful*
 * refresh. Every caller awaits the same request.
 */
let inFlightRefresh: Promise<AuthUser> | null = null;

export const refreshSession = async (): Promise<AuthUser> => {
  inFlightRefresh ??= postToAuth('refresh')
    .then(readTokens)
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
};

export const logout = async (): Promise<void> => {
  accessToken = null;
  await postToAuth('logout');
};
