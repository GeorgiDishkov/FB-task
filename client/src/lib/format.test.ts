import { describe, expect, it } from 'vitest';

import {
  describeAge,
  describeRange,
  EM_DASH,
  formatColor,
  formatMeasurement,
  isUnknownValue,
} from './format';

describe('formatMeasurement', () => {
  it.each([
    ['plain number', '172', 'cm', '172 cm'],
    ['comma-grouped number (Jabba)', '1,358', 'kg', '1,358 kg'],
    ['decimal', '1.5', 'kg', '1.5 kg'],
  ])('appends the unit to %s', (_case, raw, unit, expected) => {
    expect(formatMeasurement(raw, unit)).toBe(expected);
  });

  it.each([
    ['unknown', 'unknown'],
    ['n/a', 'n/a'],
    ['none', 'none'],
    ['mixed case', 'Unknown'],
    ['empty', ''],
  ])('renders %s as an em dash', (_case, raw) => {
    expect(formatMeasurement(raw, 'kg')).toBe(EM_DASH);
  });

  /** Never parsed with Number() — that would yield NaN for "1,358". */
  it('passes a non-numeric, non-sentinel value through untouched', () => {
    expect(formatMeasurement('tall', 'cm')).toBe('tall');
  });
});

describe('formatColor', () => {
  it('capitalises only the first letter, not every word', () => {
    expect(formatColor('white, blue')).toBe('White, blue');
    expect(formatColor('blond')).toBe('Blond');
  });

  it('renders sentinels as an em dash', () => {
    expect(formatColor('n/a')).toBe(EM_DASH);
    expect(formatColor('unknown')).toBe(EM_DASH);
  });
});

describe('isUnknownValue', () => {
  it('ignores surrounding whitespace and case', () => {
    expect(isUnknownValue('  UNKNOWN ')).toBe(true);
    expect(isUnknownValue('blond')).toBe(false);
  });
});

describe('describeRange', () => {
  it('describes a full page', () => {
    expect(describeRange(4, 10, 87)).toBe('31–40 of 87');
  });

  /** The last page of 87 records holds 7, not 10. */
  it('clamps the final page to the real total', () => {
    expect(describeRange(9, 10, 87)).toBe('81–87 of 87');
  });

  it('describes the first page', () => {
    expect(describeRange(1, 10, 87)).toBe('1–10 of 87');
  });
});

describe('describeAge', () => {
  const NOW = 1_700_000_000_000;

  it.each([
    ['seconds', 5_000, 'just now'],
    ['one minute', 60_000, '1m ago'],
    ['forty minutes', 40 * 60_000, '40m ago'],
    ['two hours', 2 * 3_600_000, '2h ago'],
  ])('describes an age of %s', (_case, elapsed, expected) => {
    expect(describeAge(NOW - elapsed, NOW)).toBe(expected);
  });

  /** A clock that moved backwards must not produce a negative age. */
  it('clamps a future timestamp to "just now"', () => {
    expect(describeAge(NOW + 60_000, NOW)).toBe('just now');
  });
});
