/**
 * One-off dev tool: writes data/users.json with a freshly hashed password.
 *
 *   npm run seed:users --workspace=server            # uses the defaults below
 *   npm run seed:users --workspace=server -- bob s3cret!
 *
 * Run once, commit the output. The plaintext never reaches the file — only a salted
 * bcrypt hash, the way a real user table stores it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { hashPassword } from '../src/auth/passwords.js';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'Password1!';

const DATA_DIRECTORY = fileURLToPath(new URL('../data', import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL('../data/users.json', import.meta.url));

const run = async (): Promise<void> => {
  const [usernameArgument, passwordArgument] = process.argv.slice(2);
  const username = usernameArgument ?? DEFAULT_USERNAME;
  const password = passwordArgument ?? DEFAULT_PASSWORD;

  const users = [
    {
      id: '1',
      username,
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    },
  ];

  mkdirSync(DATA_DIRECTORY, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify({ users }, null, 2)}\n`, 'utf8');

  console.log(`[seed] wrote ${String(users.length)} user to ${OUTPUT_PATH}`);
  console.log(`[seed] username: ${username}`);
  console.log('[seed] password: (not stored \u2014 only a salted bcrypt hash)');
};

await run();
