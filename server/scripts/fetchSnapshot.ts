/**
 * One-off dev tool: pulls every page of the Star Wars API's people endpoint and writes
 * the combined records to data/people.json. Run once, commit the output.
 *
 *   npm run snapshot --workspace=server
 *
 * Committing the data (~90 KB) rather than fetching at boot is the point: the server then
 * has no network dependency at all, starts instantly, and works with the Wi-Fi off —
 * which is what makes the offline demo reproducible.
 *
 * This is not part of the server and never runs in the request path.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const SOURCE_URL = 'https://swapi.py4e.com/api/people/';
const DATA_DIRECTORY = fileURLToPath(new URL('../data', import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL('../data/people.json', import.meta.url));

interface SwapiPageResponse {
  count: number;
  next: string | null;
  results: unknown[];
}

const fetchPage = async (pageUrl: string): Promise<SwapiPageResponse> => {
  const response = await fetch(pageUrl);

  if (!response.ok) {
    throw new Error(`${pageUrl} responded ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as SwapiPageResponse;
};

const run = async (): Promise<void> => {
  const collected: unknown[] = [];
  let nextUrl: string | null = SOURCE_URL;
  let expectedCount = 0;

  while (nextUrl !== null) {
    const page: SwapiPageResponse = await fetchPage(nextUrl);

    collected.push(...page.results);
    expectedCount = page.count;
    nextUrl = page.next;

    console.log(`[snapshot] ${collected.length}/${expectedCount} records`);
  }

  // A short read means the API paged differently than expected; better to fail than to
  // commit a truncated snapshot that quietly breaks the last page.
  if (collected.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} records, collected ${collected.length}.`);
  }

  const snapshot = { count: expectedCount, results: collected };

  mkdirSync(DATA_DIRECTORY, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log(`[snapshot] wrote ${collected.length} records to ${OUTPUT_PATH}`);
};

await run();
