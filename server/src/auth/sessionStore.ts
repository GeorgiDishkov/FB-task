import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { REFRESH_TOKEN_TTL_MS } from '../config.js';
import type { SessionRecord, StoredUser } from './types.js';

/**
 * The entire session database. Same reasoning as the people store: small, ephemeral, and
 * never redeployed, so a Map is the whole implementation. Sessions vanish on restart —
 * correct for a demo, and stated in the README so nobody files it as a bug.
 */
const sessions = new Map<string, SessionRecord>();

const TOKEN_BYTES = 32;
const SEPARATOR = '.';

const randomToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

const hashSecret = (secret: string): string =>
  createHash('sha256').update(secret).digest('hex');

/** Constant-time compare so a wrong hash cannot be probed byte by byte. */
const hashesMatch = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

/**
 * The cookie carries `sessionId.secret`. The id makes lookup O(1) — needed for reuse
 * detection, which has to find the session even when the secret is stale — and only the
 * secret half is ever hashed and compared.
 */
export const parseRefreshToken = (
  raw: string,
): { sessionId: string; secret: string } | null => {
  const separatorIndex = raw.indexOf(SEPARATOR);

  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    return null;
  }

  return {
    sessionId: raw.slice(0, separatorIndex),
    secret: raw.slice(separatorIndex + 1),
  };
};

export const createSession = (
  user: StoredUser,
): { session: SessionRecord; refreshToken: string } => {
  const sessionId = randomToken();
  const secret = randomToken();
  const now = Date.now();

  const session: SessionRecord = {
    sessionId,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    refreshTokenHash: hashSecret(secret),
    createdAt: now,
    expiresAt: now + REFRESH_TOKEN_TTL_MS,
    lastUsedAt: now,
  };

  sessions.set(sessionId, session);

  return { session, refreshToken: `${sessionId}${SEPARATOR}${secret}` };
};

/** Expired records are dropped lazily on read — a sweep timer would be a background
 *  process to manage for no benefit at this scale. */
export const getSession = (sessionId: string): SessionRecord | undefined => {
  const session = sessions.get(sessionId);

  if (session === undefined) {
    return undefined;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return undefined;
  }

  return session;
};

export const secretMatches = (session: SessionRecord, secret: string): boolean =>
  hashesMatch(session.refreshTokenHash, hashSecret(secret));

/** Issues a fresh secret for an existing session and invalidates the previous one. */
export const rotateSession = (session: SessionRecord): string => {
  const secret = randomToken();
  const now = Date.now();

  sessions.set(session.sessionId, {
    ...session,
    refreshTokenHash: hashSecret(secret),
    lastUsedAt: now,
  });

  return `${session.sessionId}${SEPARATOR}${secret}`;
};

export const deleteSession = (sessionId: string): void => {
  sessions.delete(sessionId);
};

export const countSessions = (): number => sessions.size;
