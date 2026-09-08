export const EM_DASH = '—';

/**
 * The Star Wars API uses these in place of a value. Every field is a string, so they
 * arrive alongside real data in the same column.
 */
const SENTINELS = new Set(['unknown', 'n/a', 'none', '']);

export const isUnknownValue = (raw: string): boolean =>
  SENTINELS.has(raw.trim().toLowerCase());

/**
 * Numeric-looking, allowing the comma grouping the API sometimes sends: Jabba's mass
 * arrives as "1,358". Never parsed with Number() — that yields NaN, and re-formatting
 * would only risk changing what the source said.
 */
const NUMERIC_PATTERN = /^\d[\d,]*(\.\d+)?$/;

/**
 * Units are appended because a bare "172" in a Height column is ambiguous, and the
 * API's units are documented (cm and kg). A value that is neither a sentinel nor
 * numeric is passed through untouched rather than guessed at.
 */
export const formatMeasurement = (raw: string, unit: string): string => {
  if (isUnknownValue(raw)) {
    return EM_DASH;
  }

  if (!NUMERIC_PATTERN.test(raw.trim())) {
    return raw;
  }

  return `${raw.trim()} ${unit}`;
};

/**
 * Capitalises once, not per word: "white, blue" becomes "White, blue" rather than
 * "White, Blue" — these are descriptions, not proper nouns.
 */
export const formatColor = (raw: string): string => {
  if (isUnknownValue(raw)) {
    return EM_DASH;
  }

  const trimmed = raw.trim();

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * CSS colour keywords the API's colour values map onto, for the decorative swatch.
 * Anything absent (multi-valued, or a word like "fair") simply gets no swatch.
 */
const SWATCH_COLORS: Record<string, string> = {
  black: '#111111',
  blond: '#e8d18b',
  blonde: '#e8d18b',
  blue: '#6ea8fe',
  brown: '#8b5a2b',
  green: '#4ade80',
  grey: '#9aa4b2',
  gray: '#9aa4b2',
  orange: '#fb923c',
  pale: '#e6e2d3',
  red: '#ef4444',
  silver: '#c0c7d0',
  white: '#f3f4f6',
  yellow: '#facc15',
};

export const toSwatchColor = (raw: string): string | undefined =>
  SWATCH_COLORS[raw.trim().toLowerCase()];

/** "Showing 31–40 of 87" — derived, not guessed. */
export const describeRange = (page: number, pageSize: number, total: number): string => {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return `${first}–${last} of ${total}`;
};
