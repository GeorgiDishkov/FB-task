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
