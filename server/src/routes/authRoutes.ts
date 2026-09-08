import { Router } from 'express';
import type { Request, Response } from 'express';

import { login, logout, refresh, register } from '../auth/authService.js';
import type { IssuedTokens } from '../auth/types.js';
import { AuthError } from '../auth/types.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_MS,
} from '../config.js';
import { withAuth } from '../middleware/requireAuth.js';
import type { ApiErrorBody } from '../types.js';
import { loginSchema, registerSchema } from './schemas.js';

const isProduction = process.env.NODE_ENV === 'production';

const setRefreshCookie = (response: Response, refreshToken: string): void => {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    // localhost:5173 → localhost:3001 is same-site (a differing port does not change the
    // site), so 'lax' works. 'none' would demand secure: true, which fails on plain
    // HTTP localhost.
    sameSite: 'lax',
    secure: isProduction,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
};

/** The refresh token is never in the body — only in the httpOnly cookie. */
const sendTokens = (response: Response, issued: IssuedTokens): void => {
  setRefreshCookie(response, issued.refreshToken);

  response.json({
    user: issued.user,
    accessToken: issued.accessToken,
    expiresIn: issued.expiresIn,
  });
};

const readRefreshCookie = (request: Request): string => {
  const raw: unknown = request.cookies[REFRESH_COOKIE_NAME];

  if (typeof raw !== 'string' || raw.length === 0) {
    throw new AuthError('NO_SESSION', 401, 'No refresh cookie was sent.');
  }

  return raw;
};

const loginHandler = async (request: Request, response: Response): Promise<void> => {
  // abortEarly: false so both fields report at once; narrow on `error` before reading
  // `value`, or Joi's discriminated union collapses it back to `any`.
  const result = loginSchema.validate(request.body, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    const body: ApiErrorBody = {
      error: {
        code: 'INVALID_CREDENTIALS_FORMAT',
        message: `Username and password must each be 4–30 characters.`,
      },
    };

    response.status(400).json(body);
    return;
  }

  sendTokens(response, await login(result.value.username, result.value.password));
};

const registerHandler = async (request: Request, response: Response): Promise<void> => {
  const result = registerSchema.validate(request.body, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    const body: ApiErrorBody = {
      error: {
        code: 'INVALID_CREDENTIALS_FORMAT',
        message:
          'Username and password must each be 4–30 characters, and the passwords must match.',
      },
    };

    response.status(400).json(body);
    return;
  }

  sendTokens(response, await register(result.value.username, result.value.password));
};

const refreshHandler = async (request: Request, response: Response): Promise<void> => {
  sendTokens(response, await refresh(readRefreshCookie(request)));
};

const logoutHandler = (request: Request, response: Response): void => {
  const raw: unknown = request.cookies[REFRESH_COOKIE_NAME];

  logout(typeof raw === 'string' ? raw : undefined);

  response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  response.status(204).end();
};

export const authRouter = Router();

authRouter.post('/auth/register', registerHandler);
authRouter.post('/auth/login', loginHandler);
authRouter.post('/auth/refresh', refreshHandler);
authRouter.post('/auth/logout', logoutHandler);
authRouter.get(
  '/auth/me',
  withAuth((_request, response, claims) => {
    response.json({
      user: {
        id: claims.userId,
        username: claims.username,
        displayName: claims.username,
      },
    });
  }),
);
