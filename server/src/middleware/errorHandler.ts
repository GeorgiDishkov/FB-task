import type { NextFunction, Request, Response } from 'express';

import type { ApiErrorBody } from '../types.js';

export const notFoundHandler = (_request: Request, response: Response): void => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: 'Unknown endpoint.' },
  };

  response.status(404).json(body);
};

/**
 * Last-resort handler. Express identifies error middleware by its four-parameter
 * signature, so `_next` must stay even though it is unused.
 *
 * The real error is logged server-side and never put in the response body — a stack
 * trace is not something to hand to a client.
 */
export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  console.error('[server] Unhandled error:', error);

  const body: ApiErrorBody = {
    error: { code: 'INTERNAL', message: 'Unexpected server error.' },
  };

  response.status(500).json(body);
};
