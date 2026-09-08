import { findUserByUsername, insertUser } from '../store/userStore.js';

import { burnVerificationTime, verifyPassword } from './passwords.js';
import {
  createSession,
  deleteSession,
  getSession,
  parseRefreshToken,
  rotateSession,
  secretMatches,
} from './sessionStore.js';
import { accessTokenLifetimeSeconds, signAccessToken } from './tokens.js';
import type { IssuedTokens, SessionRecord, StoredUser } from './types.js';
import { AuthError } from './types.js';

const toAuthUser = (source: StoredUser | SessionRecord) => ({
  id: 'id' in source ? source.id : source.userId,
  username: source.username,
  displayName: source.displayName,
});

const issueFor = async (user: StoredUser): Promise<IssuedTokens> => {
  const { session, refreshToken } = createSession(user);
  const accessToken = await signAccessToken({
    userId: user.id,
    username: user.username,
    sessionId: session.sessionId,
  });

  return {
    user: toAuthUser(user),
    accessToken,
    expiresIn: accessTokenLifetimeSeconds(),
    refreshToken,
  };
};

/**
 * Verifies the password against the seeded user store, the way a real login does.
 *
 * Both "no such user" and "wrong password" return the same INVALID_CREDENTIALS error.
 * Distinguishing them would let an attacker enumerate valid usernames — and the timing
 * would give it away too, which is why the missing-user branch burns the same bcrypt
 * work instead of returning immediately.
 */
export const login = async (
  username: string,
  password: string,
): Promise<IssuedTokens> => {
  const user = findUserByUsername(username);

  if (user === undefined) {
    await burnVerificationTime();
    throw new AuthError('INVALID_CREDENTIALS', 401, 'Username or password is incorrect.');
  }

  const isCorrect = await verifyPassword(password, user.passwordHash);

  if (!isCorrect) {
    throw new AuthError('INVALID_CREDENTIALS', 401, 'Username or password is incorrect.');
  }

  return issueFor(user);
};

/**
 * Creates an account and signs the new user straight in — making someone log in again
 * immediately after choosing a password is friction with no purpose.
 *
 * The uniqueness check is case-insensitive, matching how login looks users up. Anything
 * else would let "Admin" be registered alongside "admin" and then have only one of them
 * ever be reachable.
 */
export const register = async (
  username: string,
  password: string,
): Promise<IssuedTokens> => {
  if (findUserByUsername(username) !== undefined) {
    throw new AuthError('USERNAME_TAKEN', 409, 'That username is already taken.');
  }

  return issueFor(await insertUser(username, password));
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
  const accessToken = await signAccessToken({
    userId: session.userId,
    username: session.username,
    sessionId: session.sessionId,
  });

  return {
    user: toAuthUser(session),
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
