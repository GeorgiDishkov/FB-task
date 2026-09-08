import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './passwords.js';

const PASSWORD = 'Password1!';

describe('hashPassword', () => {
  it('produces a bcrypt hash that never contains the plaintext', async () => {
    const stored = await hashPassword(PASSWORD);

    // $2b$ is the modern bcrypt prefix; 12 is the cost factor.
    expect(stored.startsWith('$2b$12$')).toBe(true);
    expect(stored).not.toContain(PASSWORD);
    // 7-char prefix + 22-char salt + 31-char digest.
    expect(stored).toHaveLength(60);
  });

  /** bcrypt embeds a random salt, so identical passwords never share a hash. */
  it('salts each hash, so the same password hashes differently every time', async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);

    expect(first).not.toBe(second);
    await expect(verifyPassword(PASSWORD, first)).resolves.toBe(true);
    await expect(verifyPassword(PASSWORD, second)).resolves.toBe(true);
  });
});

describe('verifyPassword', () => {
  it('accepts the correct password', async () => {
    const stored = await hashPassword(PASSWORD);

    await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(true);
  });

  it.each([
    ['a wrong password', 'Password2!'],
    ['a case-changed password', 'password1!'],
    ['a prefix of the password', 'Password1'],
    ['an empty password', ''],
  ])('rejects %s', async (_case, candidate) => {
    const stored = await hashPassword(PASSWORD);

    await expect(verifyPassword(candidate, stored)).resolves.toBe(false);
  });

  /**
   * bcrypt.compare throws on a malformed hash rather than returning false, so the wrapper
   * has to catch. A stored value we cannot parse is not a match.
   */
  it.each([
    ['an unrecognised prefix', '$9z$12$abcdefghijklmnopqrstuv'],
    ['a truncated hash', '$2b$12$tooshort'],
    ['the plaintext stored directly', 'Password1!'],
    ['an empty string', ''],
  ])('rejects a malformed stored hash without throwing: %s', async (_case, stored) => {
    await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(false);
  });

  /** The cost travels inside the hash, so raising it later must not break old rows. */
  it('verifies a hash made with a lower cost factor', async () => {
    const lowCost = '$2b$04$xFUFz884oYM.Ryt83WNL3.JAKE76MHEEpIDoJRwqxofoNeVVk5J/a';

    await expect(verifyPassword('Password1!', lowCost)).resolves.toBe(true);
  });
});
