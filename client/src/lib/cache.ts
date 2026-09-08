import { safeGetItem, safeKeys, safeRemoveItem, safeSetItem } from './storage';

/**
 * Bump to invalidate every entry at once. This is the check people skip and the one that
 * actually matters in a real deploy: if the stored model gains a field, existing entries
 * are shaped wrong but not expired, and would quietly feed incomplete rows to the UI.
 */
export const CACHE_SCHEMA_VERSION = 1;

/**
 * Five minutes. The dataset is immutable film trivia, so an hour would be defensible —
 * this is short enough that a reviewer can watch an entry expire without waiting.
 */
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** The payload is never stored bare — always with the metadata needed to judge it later. */
export interface CacheEnvelope<Payload> {
  version: number;
  savedAt: number;
  ttlMs: number;
  payload: Payload;
}

export interface CacheHit<Payload> {
  payload: Payload;
  /** When it was written, so callers can show the age. */
  savedAt: number;
}

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const isCacheEnvelope = (value: unknown): value is CacheEnvelope<unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.version === 'number' &&
    typeof candidate.savedAt === 'number' &&
    typeof candidate.ttlMs === 'number' &&
    'payload' in candidate
  );
};

const isExpired = (envelope: CacheEnvelope<unknown>, now: number): boolean => {
  // A savedAt in the future means the system clock moved backwards after the write.
  // Without this guard `now - savedAt` is negative, negative < ttlMs is true, and the
  // entry would never expire.
  if (envelope.savedAt > now) {
    return true;
  }

  return now - envelope.savedAt >= envelope.ttlMs;
};

export const removeCache = (key: string): void => {
  safeRemoveItem(key);
};

/** Any failed check deletes the entry: a value we refuse to trust is not worth keeping. */
const discard = (key: string): null => {
  removeCache(key);

  return null;
};

/**
 * Reads and *validates*. `validate` is a type predicate, so a successful read returns
 * `Payload` with no cast at the call site — that is the type system doing real work
 * rather than decorating the check.
 *
 * The six checks, in order: present, parseable, shaped like an envelope, matching schema
 * version, unexpired, and carrying a payload the caller recognises.
 */
export const readCache = <Payload>(
  key: string,
  validate: (value: unknown) => value is Payload,
): CacheHit<Payload> | null => {
  const raw = safeGetItem(key);

  if (raw === null) {
    return null;
  }

  const parsed = parseJson(raw);

  if (parsed === undefined) {
    return discard(key);
  }

  if (!isCacheEnvelope(parsed)) {
    return discard(key);
  }

  if (parsed.version !== CACHE_SCHEMA_VERSION) {
    return discard(key);
  }

  if (isExpired(parsed, Date.now())) {
    return discard(key);
  }

  if (!validate(parsed.payload)) {
    return discard(key);
  }

  return { payload: parsed.payload, savedAt: parsed.savedAt };
};

export const writeCache = <Payload>(
  key: string,
  payload: Payload,
  ttlMs = DEFAULT_TTL_MS,
): void => {
  const envelope: CacheEnvelope<Payload> = {
    version: CACHE_SCHEMA_VERSION,
    savedAt: Date.now(),
    ttlMs,
    payload,
  };

  safeSetItem(key, JSON.stringify(envelope));
};

export const clearCacheByPrefix = (prefix: string): void => {
  safeKeys()
    .filter((key) => key.startsWith(prefix))
    .forEach(removeCache);
};
