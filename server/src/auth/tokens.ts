import { errors, jwtVerify, SignJWT } from 'jose';

import { ACCESS_TOKEN_TTL_MS, JWT_SECRET } from '../config.js';
import type { AccessTokenClaims } from './types.js';
import { AuthError } from './types.js';

const ALGORITHM = 'HS256';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export const accessTokenLifetimeSeconds = (): number =>
  Math.floor(ACCESS_TOKEN_TTL_MS / 1000);

/** Subject is the user id, not the username: an id is stable, a display name is not. */
export const signAccessToken = async (claims: AccessTokenClaims): Promise<string> =>
  new SignJWT({ sid: claims.sessionId, usr: claims.username })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ACCESS_TOKEN_TTL_MS) / 1000))
    .sign(secretKey);

/**
 * Distinguishes an expired token from an invalid one, because the client treats them
 * differently: TOKEN_EXPIRED triggers a silent refresh and one retry, UNAUTHENTICATED
 * does not. Collapsing them would either cause pointless refresh attempts or break
 * silent re-auth entirely.
 */
export const verifyAccessToken = async (token: string): Promise<AccessTokenClaims> => {
  const payload = await readPayload(token);
  const sessionId = payload.sid;
  const username = payload.usr;

  if (typeof payload.sub !== 'string' || typeof sessionId !== 'string') {
    throw new AuthError('UNAUTHENTICATED', 401, 'Token is missing required claims.');
  }

  if (typeof username !== 'string') {
    throw new AuthError('UNAUTHENTICATED', 401, 'Token is missing required claims.');
  }

  return { userId: payload.sub, username, sessionId };
};

const readPayload = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [ALGORITHM] });
    return payload;
  } catch (error) {
    throw toAuthError(error);
  }
};

const toAuthError = (error: unknown): AuthError => {
  if (error instanceof errors.JWTExpired) {
    return new AuthError('TOKEN_EXPIRED', 401, 'Access token has expired.');
  }

  return new AuthError('UNAUTHENTICATED', 401, 'Access token is invalid.');
};
