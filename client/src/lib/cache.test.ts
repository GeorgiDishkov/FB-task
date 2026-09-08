import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CACHE_SCHEMA_VERSION, DEFAULT_TTL_MS, readCache, writeCache } from './cache';
import { clearCacheByPrefix } from './cache';

const KEY = 'test.entry';
const PAYLOAD = { name: 'Luke' };

const isPayload = (value: unknown): value is typeof PAYLOAD =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { name?: unknown }).name === 'string';

const readStored = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;

const writeStored = (envelope: unknown): void => {
  localStorage.setItem(KEY, JSON.stringify(envelope));
};

const throwQuota = (): never => {
  throw new DOMException('quota exceeded', 'QuotaExceededError');
};

const throwSecurity = (): never => {
  throw new DOMException('blocked', 'SecurityError');
};

const writePayload = (): void => {
  writeCache(KEY, PAYLOAD);
};

beforeEach(() => {
  // jsdom shares localStorage across tests in a file; a leaked key makes an unrelated
  // test pass for the wrong reason.
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('writeCache / readCache', () => {
  it('round-trips the payload with its saved timestamp', () => {
    writeCache(KEY, PAYLOAD);

    const hit = readCache(KEY, isPayload);

    expect(hit?.payload).toEqual(PAYLOAD);
    expect(hit?.savedAt).toBe(Date.now());
  });

  it('stores an envelope, not the payload bare', () => {
    writeCache(KEY, PAYLOAD);

    expect(readStored()).toMatchObject({
      version: CACHE_SCHEMA_VERSION,
      savedAt: Date.now(),
      ttlMs: DEFAULT_TTL_MS,
      payload: PAYLOAD,
    });
  });

  it('returns null for a key that was never written', () => {
    expect(readCache(KEY, isPayload)).toBeNull();
  });
});

/** Each failed check must also delete the entry — a value we refuse to trust is not
 *  worth keeping around to be re-rejected. */
describe('cache validation', () => {
  it('rejects and removes unparseable JSON', () => {
    localStorage.setItem(KEY, 'not json at all');

    expect(readCache(KEY, isPayload)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('rejects and removes a value that is not an envelope', () => {
    writeStored({ nope: true });

    expect(readCache(KEY, isPayload)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('rejects and removes a stale schema version', () => {
    writeCache(KEY, PAYLOAD);
    writeStored({ ...readStored(), version: CACHE_SCHEMA_VERSION + 99 });

    expect(readCache(KEY, isPayload)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('rejects and removes an expired entry', () => {
    writeCache(KEY, PAYLOAD);
    vi.advanceTimersByTime(DEFAULT_TTL_MS + 1);

    expect(readCache(KEY, isPayload)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('serves an entry that is still within its TTL', () => {
    writeCache(KEY, PAYLOAD);
    vi.advanceTimersByTime(DEFAULT_TTL_MS - 1000);

    expect(readCache(KEY, isPayload)?.payload).toEqual(PAYLOAD);
  });

  /**
   * The backwards-clock guard. Without it `now - savedAt` is negative, negative < ttlMs
   * is true, and the entry would never expire.
   */
  it('rejects and removes an entry saved in the future', () => {
    writeCache(KEY, PAYLOAD);
    writeStored({ ...readStored(), savedAt: Date.now() + 60_000 });

    expect(readCache(KEY, isPayload)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('rejects and removes a well-formed envelope carrying the wrong payload', () => {
    writeCache(KEY, PAYLOAD);
    writeStored({ ...readStored(), payload: { name: 42 } });

    expect(readCache(KEY, isPayload)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('resilience', () => {
  /** Safari private mode throws on write; a cache is an optimisation, not a feature. */
  it('does not throw when the store refuses a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(throwQuota);

    expect(writePayload).not.toThrow();
  });

  it('does not throw when the store refuses a read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(throwSecurity);

    expect(readCache(KEY, isPayload)).toBeNull();
  });
});

describe('clearCacheByPrefix', () => {
  it('removes only the matching keys', () => {
    writeCache('fib.people.page.1', PAYLOAD);
    writeCache('fib.people.page.2', PAYLOAD);
    writeCache('fib.session', PAYLOAD);

    clearCacheByPrefix('fib.people.page.');

    expect(localStorage.getItem('fib.people.page.1')).toBeNull();
    expect(localStorage.getItem('fib.people.page.2')).toBeNull();
    expect(localStorage.getItem('fib.session')).not.toBeNull();
  });
});
