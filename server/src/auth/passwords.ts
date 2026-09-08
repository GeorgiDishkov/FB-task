import bcrypt from 'bcrypt';

/**
 * bcrypt with a cost factor of 12.
 *
 * The hash it returns is already self-describing and carries its own salt:
 * `$2b$12$<22-char salt><31-char digest>`. So there is no format to hand-roll and no
 * salt column to manage — raising COST later leaves existing rows verifiable, because
 * each hash records the cost it was made with.
 */
const COST = 12;

/**
 * bcrypt silently truncates at 72 bytes. Harmless here — the schema caps passwords at 30
 * characters — but it is the kind of limit that quietly weakens a long passphrase, so it
 * is worth knowing the cap exists rather than discovering it.
 */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, COST);

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, stored);
  } catch {
    // compare() throws on a malformed hash rather than returning false. A stored value
    // we cannot parse is not a match.
    return false;
  }
};

/**
 * A real bcrypt hash of a throwaway string, used only to burn the same work when the
 * username does not exist. Not a credential, and hardcoded rather than computed at boot
 * so startup does not pay for a hash nobody needs.
 */
const TIMING_EQUALISER_HASH =
  '$2b$12$0sKNsOxv8/QbiLwVatygdONnQlqC2pNr391MxRdvV.8yaEJzJl2H2';

/**
 * Without this, "unknown user" returns in microseconds while "wrong password" takes the
 * full bcrypt cost — a timing oracle that reveals which usernames exist regardless of
 * what the response body says.
 */
export const burnVerificationTime = async (): Promise<void> => {
  await bcrypt.compare('timing-equaliser', TIMING_EQUALISER_HASH);
};
