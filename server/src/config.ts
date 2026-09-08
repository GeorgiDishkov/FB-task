export const PORT = Number(process.env.PORT ?? 3001);

/** The Vite dev origin. Restricted rather than '*' — correct default even undeployed. */
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

/** Used to build the `next` / `previous` links in the response. */
export const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}/api`;

/**
 * Fixed by the contract we mirror, not a deployment concern — so a constant, not an env
 * var. The Star Wars API pages at 10 and has no pageSize parameter, and identical
 * behaviour from both data sources is worth more than a knob with no caller.
 */
export const PAGE_SIZE = 10;

const MILLISECONDS_PER_UNIT: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses "30s" / "15m" / "2h" / "1d" into milliseconds. */
export const parseDuration = (raw: string): number => {
  const unitKey = raw.slice(-1);
  const amount = Number(raw.slice(0, -1));
  const unitMilliseconds = MILLISECONDS_PER_UNIT[unitKey];

  if (!Number.isFinite(amount) || amount <= 0 || unitMilliseconds === undefined) {
    throw new Error(`Invalid duration "${raw}". Use a form like 30s, 15m, 2h or 1d.`);
  }

  return amount * unitMilliseconds;
};

const MINIMUM_SECRET_LENGTH = 32;

/**
 * Deliberately no fallback. A hardcoded development secret is the most common way a real
 * one ends up committed later, so the server refuses to boot instead.
 */
const readSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set to at least ${MINIMUM_SECRET_LENGTH} characters. ` +
        'Copy server/.env.example to server/.env and generate one.',
    );
  }

  return secret;
};

export const JWT_SECRET = readSecret();

/** Short, because a JWT cannot be revoked before it expires. */
export const ACCESS_TOKEN_TTL_MS = parseDuration(process.env.ACCESS_TOKEN_TTL ?? '15m');

/** Longer, because this one is revocable server-side. */
export const REFRESH_TOKEN_TTL_MS = parseDuration(process.env.REFRESH_TOKEN_TTL ?? '1d');

export const REFRESH_COOKIE_NAME = 'fib_refresh';

/** Scoped so the cookie never rides along with data requests. */
export const REFRESH_COOKIE_PATH = '/api/auth';
