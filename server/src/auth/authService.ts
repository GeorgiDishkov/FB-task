import {
  createSession,
  deleteSession,
  getSession,
  parseRefreshToken,
  rotateSession,
  secretMatches,
} from './sessionStore.js';
import { accessTokenLifetimeSeconds, signAccessToken } from './tokens.js';
import type { IssuedTokens } from './types.js';
import { AuthError } from './types.js';

/**
 * There is no user store, so any username that passed the schema is accepted. The task
 * supplies no credentials, and inventing some would make the demo harder to review, not
 * more honest. What is real here is the token lifecycle below.
 */
export const login = async (username: string): Promise<IssuedTokens> => {
  const { session, refreshToken } = createSession(username);
  const accessToken = await signAccessToken(username, session.sessionId);

  return {
    user: { username },
    accessToken,
    expiresIn: accessTokenLifetimeSeconds(),
    refreshToken,
  };
};

/**
 * Exchanges a refresh token for a new access token, rotating the refresh token as it
 * goes. A replayed (already-rotated) token revokes the whole session rather than merely
 * failing: if an old secret is being presented, either it leaked or the client is
 * broken, and neither warrants keeping the session alive.
 */
export const refresh = async (rawRefreshToken: string): Promise<IssuedTokens> => {
  const parsed = parseRefreshToken(rawRefreshToken);

  if (parsed === null) {
    throw new AuthError('SESSION_EXPIRED', 401, 'Refresh token is malformed.');
  }

  const session = getSession(parsed.sessionId);

  if (session === undefined) {
    throw new AuthError('SESSION_EXPIRED', 401, 'Session has expired or was ended.');
  }

  if (!secretMatches(session, parsed.secret)) {
    deleteSession(session.sessionId);
    throw new AuthError('SESSION_REVOKED', 401, 'Refresh token was already used.');
  }

  const refreshToken = rotateSession(session);
  const accessToken = await signAccessToken(session.username, session.sessionId);

  return {
    user: { username: session.username },
    accessToken,
    expiresIn: accessTokenLifetimeSeconds(),
    refreshToken,
  };
};

/** Idempotent: logging out twice is not an error worth surfacing. */
export const logout = (rawRefreshToken: string | undefined): void => {
  if (rawRefreshToken === undefined) {
    return;
  }

  const parsed = parseRefreshToken(rawRefreshToken);

  if (parsed === null) {
    return;
  }

  deleteSession(parsed.sessionId);
};
