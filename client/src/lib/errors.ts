export type AppErrorKind =
  'network' | 'timeout' | 'http' | 'parse' | 'aborted' | 'unknown';

/**
 * One taxonomy for every failure the app can see. Surfaces discriminate on `kind`
 * rather than string-matching a message, so each can choose its own presentation
 * without re-deriving the cause.
 *
 * Fields are declared rather than declared as constructor parameter properties, which
 * `erasableSyntaxOnly` rejects.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status: number | undefined;

  constructor(kind: AppErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
  }
}

const isDomExceptionNamed = (error: unknown, name: string): boolean =>
  error instanceof DOMException && error.name === name;

export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  // AbortSignal.timeout() aborts with a TimeoutError, a caller's controller with an
  // AbortError. They must not be conflated: one is a real failure to report, the other
  // is us cancelling on purpose.
  if (isDomExceptionNamed(error, 'TimeoutError')) {
    return new AppError('timeout', 'The request took too long.');
  }

  if (isDomExceptionNamed(error, 'AbortError')) {
    return new AppError('aborted', 'Request cancelled.');
  }

  // A rejected fetch means the request never left the machine — offline, DNS failure,
  // CORS, or blocked. This is the offline path.
  if (error instanceof TypeError) {
    return new AppError('network', 'Could not reach the server.');
  }

  if (error instanceof SyntaxError) {
    return new AppError('parse', 'Unexpected response from the server.');
  }

  return new AppError('unknown', 'Something went wrong.');
};

/** Timeout is folded in: from the user's side it looks like connectivity. */
export const isOfflineError = (error: AppError): boolean =>
  error.kind === 'network' || error.kind === 'timeout';

export const isAbortError = (error: AppError): boolean => error.kind === 'aborted';

const HTTP_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please log in again.',
  404: "We couldn't find that page of results.",
  429: 'Too many requests — try again shortly.',
};

const KIND_MESSAGES: Record<AppErrorKind, string> = {
  network: 'You appear to be offline.',
  timeout: 'The request took too long.',
  http: 'The Star Wars API is having trouble. Try again.',
  parse: 'We got an unexpected response.',
  aborted: '',
  unknown: 'Something went wrong.',
};

/**
 * Distinguishing 4xx from 5xx matters: "try again" is useless advice for a 404 and
 * correct advice for a 503.
 */
export const toUserMessage = (error: AppError): string => {
  if (error.kind !== 'http' || error.status === undefined) {
    return KIND_MESSAGES[error.kind];
  }

  return HTTP_MESSAGES[error.status] ?? KIND_MESSAGES.http;
};
