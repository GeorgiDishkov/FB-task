/**
 * Every localStorage touch goes through these.
 *
 * Accessing localStorage can *throw*, not merely fail: Safari's private mode and some
 * enterprise "block site data" settings raise SecurityError on read as well as write.
 * An unguarded localStorage call at module scope white-screens the whole app for those
 * users, which is a steep price for an optimisation.
 */
export const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // QuotaExceededError, or a store that refuses writes. A cache is an optimisation;
    // a failed write must never break a page load.
  }
};

export const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing useful to do, and nothing depends on it succeeding.
  }
};

export const safeKeys = (): string[] => {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
};
