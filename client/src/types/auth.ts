export interface AuthUser {
  username: string;
}

/** Shape of POST /api/auth/login and /api/auth/refresh. The refresh token is
 *  deliberately absent — it only ever travels in the httpOnly cookie. */
export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

/**
 * Three states, not a boolean. The access token lives in memory, so it is always absent
 * at mount — a boolean guard would redirect a signed-in user to the login page on every
 * page refresh, before the silent refresh could resolve. `bootstrapping` makes "don't
 * know yet" representable, so waiting becomes the natural thing to write.
 */
export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';
