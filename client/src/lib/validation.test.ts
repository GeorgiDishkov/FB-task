import { describe, expect, it } from 'vitest';

import {
  FIELD_MAX_LENGTH,
  FIELD_MIN_LENGTH,
  isLoginFormValid,
  validateLoginForm,
} from './validation';

const VALID = { username: 'georgi', password: 'secret123' };

const usernameOf = (username: string) => ({ ...VALID, username });
const passwordOf = (password: string) => ({ ...VALID, password });

// Hoisted out of the test body: describe → it → flatMap would be three nested
// callbacks, which AGENT.md §3 caps at two.
const INVALID_CASES = [
  { username: '', password: '' },
  { username: 'ab', password: 'ab' },
  { username: 'a'.repeat(99), password: 'a'.repeat(99) },
];

const collectAllMessages = (): string[] =>
  INVALID_CASES.flatMap((values) => Object.values(validateLoginForm(values)));

describe('validateLoginForm · username', () => {
  it.each([
    ['empty', '', 'Username is required.'],
    ['whitespace only', '   ', 'Username is required.'],
    ['below minimum', 'abc', `Username must be at least ${FIELD_MIN_LENGTH} characters.`],
    [
      'padded but short once trimmed',
      '  ab  ',
      `Username must be at least ${FIELD_MIN_LENGTH} characters.`,
    ],
    [
      'above maximum',
      'a'.repeat(FIELD_MAX_LENGTH + 1),
      `Username must be ${FIELD_MAX_LENGTH} characters or fewer.`,
    ],
  ])('rejects %s', (_case, username, expected) => {
    expect(validateLoginForm(usernameOf(username)).username).toBe(expected);
  });

  it.each([
    ['exactly the minimum', 'a'.repeat(FIELD_MIN_LENGTH)],
    ['exactly the maximum', 'a'.repeat(FIELD_MAX_LENGTH)],
    ['padded but long enough once trimmed', '  georgi  '],
  ])('accepts %s', (_case, username) => {
    expect(validateLoginForm(usernameOf(username)).username).toBeUndefined();
  });
});

describe('validateLoginForm · password', () => {
  it.each([
    ['empty', '', 'Password is required.'],
    ['below minimum', 'abc', `Password must be at least ${FIELD_MIN_LENGTH} characters.`],
    [
      'above maximum',
      'a'.repeat(FIELD_MAX_LENGTH + 1),
      `Password must be ${FIELD_MAX_LENGTH} characters or fewer.`,
    ],
  ])('rejects %s', (_case, password, expected) => {
    expect(validateLoginForm(passwordOf(password)).password).toBe(expected);
  });

  /**
   * The most useful test in the file. It pins the deliberate asymmetry — .trim() on the
   * username schema, none on the password — so a future "just add .trim() to both" fails
   * loudly instead of silently changing what counts as a valid password.
   */
  it('accepts a password made entirely of spaces', () => {
    expect(validateLoginForm(passwordOf('    ')).password).toBeUndefined();
    expect(isLoginFormValid(passwordOf('    '))).toBe(true);
  });
});

describe('validateLoginForm · both fields', () => {
  it('returns no errors for a valid pair', () => {
    expect(validateLoginForm(VALID)).toEqual({});
    expect(isLoginFormValid(VALID)).toBe(true);
  });

  /** Regression guard for `abortEarly: false`. With Joi's default only one key comes
   *  back, and the user would fix errors one at a time. */
  it('reports both fields at once when both are invalid', () => {
    const errors = validateLoginForm({ username: '', password: '' });

    expect(Object.keys(errors).sort()).toEqual(['password', 'username']);
  });

  it('reports only the offending field when one is invalid', () => {
    expect(Object.keys(validateLoginForm(usernameOf('ab')))).toEqual(['username']);
    expect(isLoginFormValid(usernameOf('ab'))).toBe(false);
  });

  /** Every rule we can reach has a custom message; Joi's defaults quote the key. */
  it('never leaks a Joi default message', () => {
    const messages = collectAllMessages();

    expect(messages).not.toHaveLength(0);

    for (const message of messages) {
      expect(message).not.toContain('"');
    }
  });
});
