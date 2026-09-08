import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { hashPassword } from '../auth/passwords.js';
import type { StoredUser } from '../auth/types.js';

const USERS_PATH = fileURLToPath(new URL('../../data/users.json', import.meta.url));
const TEMP_PATH = `${USERS_PATH}.tmp`;

interface UsersFile {
  users: StoredUser[];
}

const readUsersFile = (): string => {
  try {
    return readFileSync(USERS_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read the user store at ${USERS_PATH}. Run: npm run seed:users`,
      { cause: error },
    );
  }
};

const loadUsers = (): StoredUser[] => {
  const file = JSON.parse(readUsersFile()) as UsersFile;

  if (!Array.isArray(file.users) || file.users.length === 0) {
    throw new Error(`User store at ${USERS_PATH} is empty. Run: npm run seed:users`);
  }

  return file.users;
};

/**
 * Read once at boot, then held in memory — but no longer frozen, because registration
 * writes to it. That is the honest consequence of adding a write path: "in memory with no
 * persistence" stops being a design decision and becomes data loss the moment users can
 * create an account, so this store persists.
 */
const users = loadUsers();

const normalise = (username: string): string => username.trim().toLowerCase();

/**
 * Written to a temp file and renamed, so a crash mid-write cannot leave a truncated
 * users.json behind — rename is atomic on the same filesystem. Cheap, and the difference
 * between losing one registration and losing the whole store.
 */
const persist = (): void => {
  const file: UsersFile = { users };

  writeFileSync(TEMP_PATH, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  renameSync(TEMP_PATH, USERS_PATH);
};

/**
 * Usernames are matched case-insensitively: "Admin" and "admin" are the same account,
 * which is what every real login does. The stored casing is what gets displayed.
 */
export const findUserByUsername = (username: string): StoredUser | undefined => {
  const wanted = normalise(username);

  return users.find((user) => normalise(user.username) === wanted);
};

const nextUserId = (): string => {
  const highest = users.reduce((largest, user) => Math.max(largest, Number(user.id)), 0);

  return String(highest + 1);
};

/**
 * Appends a user and persists. Callers must have already checked the username is free —
 * `registerUser` in authService does, and returns a conflict if not.
 */
export const insertUser = async (
  username: string,
  password: string,
): Promise<StoredUser> => {
  const trimmed = username.trim();

  const user: StoredUser = {
    id: nextUserId(),
    username: trimmed,
    displayName: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  persist();

  return user;
};

export const getUserCount = (): number => users.length;
