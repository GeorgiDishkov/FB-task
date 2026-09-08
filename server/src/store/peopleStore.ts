import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { PAGE_SIZE } from '../config.js';
import type { SwapiPersonDto } from '../types.js';

const SNAPSHOT_PATH = fileURLToPath(new URL('../../data/people.json', import.meta.url));

interface SnapshotFile {
  results: SwapiPersonDto[];
}

const readSnapshotFile = (): string => {
  try {
    return readFileSync(SNAPSHOT_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read the snapshot at ${SNAPSHOT_PATH}. Run: npm run snapshot`,
      { cause: error },
    );
  }
};

const loadPeople = (): readonly SwapiPersonDto[] => {
  const snapshot = JSON.parse(readSnapshotFile()) as SnapshotFile;

  if (!Array.isArray(snapshot.results)) {
    throw new Error(`Snapshot at ${SNAPSHOT_PATH} has no results array.`);
  }

  if (snapshot.results.length === 0) {
    throw new Error(`Snapshot at ${SNAPSHOT_PATH} is empty. Run: npm run snapshot`);
  }

  return Object.freeze(snapshot.results);
};

/**
 * Read once, at module init — this is the entire "database". It runs before the server
 * accepts a connection, so there is nothing to make async, and a bad or missing snapshot
 * fails loudly at boot rather than serving 500s later.
 *
 * Frozen because it is the only copy; a handler must not be able to mutate it.
 */
const people = loadPeople();

export const getTotalCount = (): number => people.length;

export const getTotalPages = (): number => Math.ceil(people.length / PAGE_SIZE);

export const getPeopleSlice = (page: number): readonly SwapiPersonDto[] =>
  people.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
