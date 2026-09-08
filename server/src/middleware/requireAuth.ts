import type { NextFunction, Request, Response } from 'express';

import type { AccessTokenClaims } from '../auth/types.js';
import { AuthError } from '../auth/types.js';
import { verifyAccessToken } from '../auth/tokens.js';

const BEARER_PREFIX = 'Bearer ';

const readBearerToken = (header: string | undefined): string => {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw new AuthError('UNAUTHENTICATED', 401, 'Authorization header is missing.');
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  if (token.length === 0) {
    throw new AuthError('UNAUTHENTICATED', 401, 'Bearer token is empty.');
  }

  return token;
};

export const readClaims = async (request: Request): Promise<AccessTokenClaims> =>
  verifyAccessToken(readBearerToken(request.headers.authorization));

/**
 * Gate for routes that only need the caller to be authenticated, not to know who they
 * are. Throwing rather than calling next(error) is fine: Express 5 forwards a rejected
 * async middleware to the error handler.
 */
export const requireAuth = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  await readClaims(request);
  next();
};

type AuthedHandler = (
  request: Request,
  response: Response,
  claims: AccessTokenClaims,
) => void | Promise<void>;

/**
 * For routes that need the claims themselves. Passing them as an argument avoids
 * augmenting Express's Request type with a global `declare module`, so the data flow
 * stays explicit and nothing has to be cast.
 */
export const withAuth =
  (handler: AuthedHandler) =>
  async (request: Request, response: Response): Promise<void> => {
    const claims = await readClaims(request);
    await handler(request, response, claims);
  };
