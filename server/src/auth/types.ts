/** What the client is told about the signed-in user. Never the hash. */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

/** A row in the user store. Mirrors what a real users table would hold. */
export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  /** bcrypt hash — `$2b$12$<salt><digest>`, salt and cost included. Never a plaintext password. */
  passwordHash: string;
  createdAt: string;
}

export interface AccessTokenClaims {
  userId: string;
  username: string;
  sessionId: string;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  /** SHA-256 of the refresh secret. The store never holds a usable credential. */
  refreshTokenHash: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number;
}

export interface IssuedTokens {
  user: AuthUser;
  accessToken: string;
  /** Seconds until the access token expires — the client schedules nothing on it, but
   *  it makes the lifetime visible in DevTools without decoding the JWT. */
  expiresIn: number;
  /** The composite `sessionId.secret` value that goes in the httpOnly cookie. */
  refreshToken: string;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS_FORMAT'
  | 'INVALID_CREDENTIALS'
  | 'USERNAME_TAKEN'
  | 'NO_SESSION'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED';

/**
 * Thrown by the auth layer and mapped to a response by the central error handler.
 *
 * Handlers therefore stay flat: no try/catch around every call, which would nest an
 * `if (error instanceof …)` inside a `catch` and breach AGENT.md §3. Express 5 forwards
 * rejected promises from async handlers to the error middleware automatically.
 */
export class AuthError extends Error {
  // Declared as fields rather than constructor parameter properties: the latter emit
  // runtime assignments, which `erasableSyntaxOnly` rejects.
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode, status: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}
