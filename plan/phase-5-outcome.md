# Phase 5 · Outcome

Status: **complete and verified.** Requirement 11 is done: a localStorage cache with
real validation logic. The offline modal and error handling (12–13) are Phase 6.

Built to [FE/05-caching.md](FE/05-caching.md).

## What landed

```
client/src/
├─ lib/
│  ├─ storage.ts              safeGetItem / safeSetItem / safeRemoveItem / safeKeys
│  ├─ cache.ts                envelope, six validation checks, prefix clearing
│  ├─ cache.test.ts           13 cases
│  ├─ schemas.ts              Joi peoplePageSchema + isPeoplePage predicate
│  └─ format.ts               + describeAge for the badge
├─ services/swapi.ts          cache-aside, key builder, clearPeopleCache
├─ hooks/usePeople.ts         + cachedAt in state, + refresh()
└─ pages/TablePage/elements/TableHeader/
   ├─ TableHeader.tsx         + "Refresh data" control
   └─ elements/CacheBadge/    "Cached · 2m ago" / "Live"
```

## Key and envelope

```
fib.swapi.people.v1.page.4
└┬┘ └──┬──┘ └─┬──┘ └┬┘ └──┬─┘
 │     │      │     │     └─ one entry per page
 │     │      │     └─ schema version
 │     │      └─ resource
 │     └─ namespace
 └─ app prefix
```

Confirmed in the browser: `{ version: 1, savedAt, ttlMs: 300000, payload }`, with the
payload holding `people`, `totalCount`, `totalPages`, `page`. One entry per page, so a
page can expire on its own and a partial cache is still useful — verified by visiting
pages 1–3 and finding three separate keys.

## The six validation checks — every one verified in the browser

Tested the way a reviewer would: hand-edit the stored entry, then navigate away and back.
The `CacheBadge` is the discriminator — **Cached** means the stored copy was served,
**Live** means it was rejected and refetched.

| Hand-edit | Expected | Badge | Key afterwards |
|---|---|---|---|
| *(none — control)* | served from store | **Cached · just now** | untouched, age preserved |
| `NOT JSON` | rejected | **Live** | rewritten, valid |
| `version: 99` | rejected | **Live** | rewritten, valid |
| `savedAt` older than `ttlMs` | rejected | **Live** | rewritten, valid |
| `savedAt` 10 minutes in the **future** | rejected | **Live** | rewritten, valid |
| `{ nope: true }` — not an envelope | rejected | **Live** | rewritten, valid |
| valid envelope, `totalCount: "87"` | rejected | **Live** | rewritten, valid |

The last row is the one that justifies `convert: false` on the Joi read. With Joi's
default `convert: true`, `"87"` would coerce to `87`, validate happily, and put a string
where the UI expects a number. A cache read is *verification*, not parsing.

The future-`savedAt` row is the backwards-clock guard. Without it `now - savedAt` is
negative, `negative < ttlMs` is true, and the entry would never expire.

Every rejection also **deletes** the entry — a value we refuse to trust is not worth
keeping around to be re-rejected on the next read.

## The core requirement, measured

- **A cached page loads with zero network requests.** Reloaded `/table?page=1` and
  `read_network_requests` filtered to `swapi.py4e.com` returned **no requests recorded**,
  while the table rendered 10 rows and the badge read "Cached".
- **Revisiting a page serves the stored copy.** Navigated 1 → 5 → 1: the badge showed
  "Cached · just now" and the entry's `savedAt` was **preserved** (29.5 s old, not reset).
  That age is the definitive proof — a refetch would have reset it to zero.
- **"Refresh data" discards and refetches.** Badge flipped to **Live** and the entry was
  freshly written.

## One false alarm worth recording

An early probe reported "Live" where "Cached" was expected, after three rapid
navigations with a 1.5 s settle. Re-running with a 3 s wait gave "Cached · just now"
**and an unchanged `savedAt`** — so it was my probe reading the DOM before the render
settled, not a cache miss. Worth writing down because the obvious conclusion ("the cache
is flaky") was wrong, and the entry age is what distinguished the two.

## Tests: 63 passing (13 new)

`cache.test.ts` covers the same ground headlessly, with `vi.useFakeTimers()` so nothing
sleeps: round-trip with timestamp, envelope shape on disk, missing key, unparseable JSON,
non-envelope, stale version, expired, still-within-TTL, future `savedAt`, wrong payload
type, prefix clearing hitting only matching keys, and both resilience cases —
`setItem` throwing `QuotaExceededError` and `getItem` throwing `SecurityError`.

`localStorage.clear()` runs in `beforeEach`: jsdom shares the store across tests in a
file, and a leaked key makes an unrelated test pass for the wrong reason.

## Design points

- **Every localStorage touch goes through `lib/storage.ts`.** Accessing localStorage can
  *throw*, not merely fail — Safari private mode and some enterprise "block site data"
  settings raise `SecurityError` on read as well as write. An unguarded call at module
  scope white-screens the app for those users, which is a steep price for an optimisation.
  Both throw paths are unit-tested.
- **The cache is checked inside the service, not the hook.** Every caller gets caching
  for free and `usePeople` never learns that storage exists — which is also what keeps it
  testable against a stubbed service.
- **`cachedAt` rides alongside `PeoplePage`, not inside it.** Where a copy came from is a
  transport concern, not part of the domain model.
- **Expired means discard, not stale-while-revalidate.** The task asks for *simple*
  validation logic and discard is the honest reading; SWR would need a second
  "revalidating" state plus a guard against the page having changed meanwhile. Noted in
  the plan as the first thing I'd change with more time.
- **5-minute TTL** so a reviewer can watch an entry expire without waiting. The dataset
  is immutable film trivia, so an hour would be equally defensible.
- **The auth session is in an `httpOnly` cookie, the cache in localStorage.** Different
  stores on purpose: "clear cached data" and "log out" must not be the same button.
  Confirmed `sessionStorage` is empty.

## Deviations from the plan

| Plan | Built | Why |
|---|---|---|
| `readCache(key, validate?)` with an optional predicate | `validate` is **required** | One caller, and it always passes one (§2) |
| `readCache` returns `Payload \| null` | Returns `{ payload, savedAt } \| null` | The badge needs the age, and the read already has it |

## Known limitation

**The cache key does not encode the data source.** Switching `VITE_API_BASE_URL` between
SWAPI and the local backend would serve entries written by the other one. Harmless in
practice — both return byte-identical shapes and identical `url`-derived ids, verified in
Phase 1 — but it is a real edge, and the fix if it ever mattered is a source segment in
the key rather than a version bump.

## Verified

- [x] `npm run build` — clean; bundle 446 kB / 137 kB gzipped
- [x] `npm run lint` — 0 errors, 0 warnings at `--max-warnings 0`
- [x] `npm test` — 63 passing in 7 files
- [x] `npx prettier --check .` — clean
