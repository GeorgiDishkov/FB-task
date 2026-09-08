import { AppError, toAppError } from '@lib/errors';

import { getAccessToken, refreshSession } from './authService';
import { REQUEST_TIMEOUT_MS, SERVER_BASE_URL } from './constants';

/**
 * The bearer token goes only to our own API. In SWAPI mode the request targets a public
 * third party, and sending a credential there would leak it to someone else's server.
 * The check is on the URL, not a mode flag.
 */
const isOwnApi = (url: string): boolean => url.startsWith(SERVER_BASE_URL);

/**
 * A timeout matters more than it looks: throttled to a very slow profile, fetch hangs
 * indefinitely and a spinner spins forever. A cap turns that into a real, handleable
 * error — which is what the error-handling requirement is about.
 *
 * The caller's signal (page changes aborting in-flight requests) is combined with it, so
 * either can cancel.
 */
const buildSignal = (callerSignal: AbortSignal | undefined): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  if (callerSignal === undefined) {
    return timeoutSignal;
  }

  return AbortSignal.any([callerSignal, timeoutSignal]);
};

const sendRequest = async (url: string, signal: AbortSignal): Promise<Response> => {
  const token = isOwnApi(url) ? getAccessToken() : null;

  try {
    return await fetch(url, {
      signal,
      // Always an object: exactOptionalPropertyTypes rejects an explicit undefined here.
      headers: token === null ? {} : { Authorization: `Bearer ${token}` },
      credentials: isOwnApi(url) ? 'include' : 'omit',
    });
  } catch (error) {
    throw toAppError(error);
  }
};

interface ErrorEnvelope {
  error?: { code?: string };
}

const readErrorCode = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => null)) as ErrorEnvelope | null;

  return body?.error?.code ?? 'UNKNOWN';
};

/**
 * Only an expired access token is worth retrying. UNAUTHENTICATED means there was never
 * a usable token, so refreshing would be a pointless round trip — which is exactly why
 * the server distinguishes the two codes.
 */
const needsRefresh = async (url: string, response: Response): Promise<boolean> => {
  if (!isOwnApi(url) || response.status !== 401) {
    return false;
  }

  return (await readErrorCode(response)) === 'TOKEN_EXPIRED';
};

const refreshOrFail = async (): Promise<void> => {
  // refreshSession() memoises its in-flight promise, so concurrent 401s share one
  // request. Without that, rotation would invalidate all but one and sign the user out
  // in the middle of a successful refresh.
  const succeeded = await refreshSession().then(
    () => true,
    () => false,
  );

  if (!succeeded) {
    throw new AppError('http', 'Your session has expired. Please log in again.', 401);
  }
};

const readJson = async <Payload>(response: Response): Promise<Payload> => {
  try {
    return (await response.json()) as Payload;
  } catch (error) {
    throw toAppError(error);
  }
};

export const requestJson = async <Payload>(
  url: string,
  signal?: AbortSignal,
): Promise<Payload> => {
  const requestSignal = buildSignal(signal);
  let response = await sendRequest(url, requestSignal);

  if (await needsRefresh(url, response)) {
    await refreshOrFail();
    // Retried exactly once, and not in a loop: an endpoint returning 401 for some other
    // reason cannot spin. The original timeout signal is reused deliberately, so the
    // whole attempt shares one budget.
    response = await sendRequest(url, requestSignal);
  }

  if (!response.ok) {
    throw new AppError(
      'http',
      `Request failed with ${String(response.status)}.`,
      response.status,
    );
  }

  return readJson<Payload>(response);
};
