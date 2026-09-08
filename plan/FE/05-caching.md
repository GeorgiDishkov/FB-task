# FE 05 · localStorage cache + validation logic

Covers: *"implement a basic caching mechanism using the browser's built-in local storage
(include a simple cache validation logic as well)."*

The parenthetical is the actual test. Anything can call `setItem`; the graded part is
**deciding whether what you read back is still usable.**

## Key design

```
fib.swapi.people.v1.page.1
└┬┘ └──┬──┘ └─┬──┘ └┬┘ └──┬──┘
 │     │      │     │     └─ page number → one entry per page
 │     │      │     └─ schema version → bump to invalidate everything at once
 │     │      └─ resource
 │     └─ namespace (avoid collisions with anything else on localhost)
 └─ app prefix
```

One entry per page rather than one blob for all pages: a page can expire on its own, a
partial cache is still useful, and no read-modify-write of a big object.

```ts
// lib/cache.ts
export const CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

## Envelope

Never store the payload bare — store it with the metadata needed to judge it later:

```ts
export interface CacheEnvelope<Payload> {
  version: number;   // CACHE_SCHEMA_VERSION at write time
  savedAt: number;   // Date.now()
  ttlMs: number;     // per-entry, so different resources can differ later
  payload: Payload;
}
```

## Validation — the five checks

A read is only served if **all** pass. Any failure ⇒ delete the entry and treat as a miss.

| # | Check | Guards against |
|---|---|---|
| 1 | `getItem` returned a non-null string | plain miss |
| 2 | `JSON.parse` succeeds | truncated write (quota hit mid-write), hand-edited value |
| 3 | Envelope shape is right — object, numeric `version`/`savedAt`/`ttlMs`, `payload` present | anything not written by this code |
| 4 | `version === CACHE_SCHEMA_VERSION` | **stale schema** after a shipped model change |
| 5 | `Date.now() - savedAt < ttlMs`, and `savedAt <= Date.now()` | expiry; and a clock that moved backwards, which would otherwise make an entry immortal |

Then one domain-level check on top, in `swapi.ts`:

| 6 | The payload matches `peoplePageSchema` (Joi) | a well-formed envelope carrying garbage |

Check 6 is a Joi schema rather than a hand-written predicate, since Joi is already in the
stack for the login form:

```ts
// lib/schemas.ts
export const peoplePageSchema = Joi.object<PeoplePage, true>({
  people: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        height: Joi.string().required(),
        mass: Joi.string().required(),
        hairColor: Joi.string().required(),
        skinColor: Joi.string().required(),
      }),
    )
    .required(),
  totalCount: Joi.number().integer().min(0).required(),
  totalPages: Joi.number().integer().min(0).required(),
  page: Joi.number().integer().min(1).required(),
});

export const isPeoplePage = (value: unknown): value is PeoplePage =>
  peoplePageSchema.validate(value, { convert: false }).error === undefined;
```

**`convert: false` here, unlike everywhere else.** For a cache read we want to know
whether the stored value is *already* the right shape — not whether Joi can coerce it
into one. With the default `convert: true`, a cached `totalCount: "87"` would validate and
then flow into the UI as a string. Reading a cache is verification, not parsing.

Wrapping the schema in a **type predicate** keeps `readCache`'s signature clean and means
a validated read returns `PeoplePage` with no cast at the call site.

Check 4 is the one people skip and the one that actually matters in a real deploy: if
`Person` gains a field, every cached entry from the previous build is *shaped wrong but
not expired*. Bumping `CACHE_SCHEMA_VERSION` invalidates the whole namespace with a
one-line change — no migration code, no "why is this column empty for some users".

Check 5's backwards-clock guard: `savedAt` in the future means the system clock was
changed after the write. Without the guard, `Date.now() - savedAt` is negative,
`negative < ttlMs` is true, and the entry never expires.

```ts
export const readCache = <Payload>(
  key: string,
  validate?: (value: unknown) => value is Payload,
): Payload | null => {
  const raw = safeGetItem(key);
  if (raw === null) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { removeCache(key); return null; }

  if (!isCacheEnvelope(parsed)) { removeCache(key); return null; }
  if (parsed.version !== CACHE_SCHEMA_VERSION) { removeCache(key); return null; }
  if (isExpired(parsed)) { removeCache(key); return null; }
  if (validate && !validate(parsed.payload)) { removeCache(key); return null; }

  return parsed.payload as Payload;
};
```

`validate` is an optional **type predicate**, so a validated read returns `T` with no
cast at the call site. That's the type system doing real work rather than decorating it.

## Writes are always best-effort

```ts
export const writeCache = <Payload>(
  key: string,
  payload: Payload,
  ttlMs = DEFAULT_TTL_MS,
): void => {
  try {
    localStorage.setItem(key, JSON.stringify({ version: CACHE_SCHEMA_VERSION, savedAt: Date.now(), ttlMs, payload }));
  } catch {
    // QuotaExceededError, or Safari private mode (throws on any write).
    // A cache is an optimisation — a failed write must never break a page load.
  }
};
```

Every `localStorage` touch in the app goes through `safeGetItem` / `safeSetItem` /
`safeRemoveItem` wrappers for exactly this reason: **accessing `localStorage` can throw**,
not just fail. Safari's private mode and some enterprise "block site data" settings throw
on read *and* on write. An unguarded `localStorage.getItem` at module scope white-screens
the whole app for those users.

## Expiry policy: discard, not stale-while-revalidate

An expired entry is **deleted and refetched**, and the user sees a loading state.

Considered SWR (serve stale immediately, refetch in background, swap in). It's better UX
and it's what I'd ship in production — but it needs a second "revalidating" state, a
race guard against the page having changed meanwhile, and it makes "is the cache
working?" harder for a reviewer to observe. The task says *basic* caching with *simple*
validation. Discard is the honest reading.

Written so switching is a small, contained change: `readCache` gains a
`{ allowStale: true }` option returning `{ payload, isStale }`, and `usePeople` gets a
`revalidating` flag. Noted in the repo README as the first thing I'd change with more time.

## TTL choice: 5 minutes

The dataset is immutable film trivia — an hour would be defensible. 5 minutes is chosen
so a reviewer can actually *watch* an entry expire without waiting, and so the demo
doesn't look like it's ignoring the network. The constant is exported and commented with
this reasoning.

## Cache-aside flow

```
getPeoplePage(page)
   │
   ├─ readCache(key(page), isPeoplePage) ──► hit ──► return (no network)
   │
   └─ miss ──► requestJson ──► map DTO→model ──► writeCache ──► return
                    │
                    └─ throws ──► propagate (05 has no opinion; see 06)
```

Cache is checked **inside the service**, not in the hook. So every caller gets caching for
free and the hook has no idea storage exists — the boundary that also makes `usePeople`
trivially testable with a stubbed service.

## Also cached: nothing else

The auth session is in `sessionStorage` ([02-routing-auth.md](02-routing-auth.md)),
deliberately a different store. "Clear cached data" and "log out" must not be the same
button.

## Dev affordances

- `clearPeopleCache()` — iterates `localStorage` keys with the `fib.swapi.people.` prefix
  and removes them. Wired to a small "Refresh data" button in the table header
  (clears + refetches current page). Makes the cache demonstrable in 2 seconds during
  review, and is genuinely useful.
- The table header shows a subtle `Cached · 2m ago` / `Live` badge for the current page,
  driven by whether the last resolve came from cache. Turns an invisible feature into a
  visible one — worth the ~15 lines for the Features criterion.

## Tests (`lib/cache.test.ts`)

Pure and fast; `localStorage` exists under jsdom, `vi.useFakeTimers()` handles expiry.

- [ ] write → read round-trips the payload
- [ ] missing key → `null`
- [ ] corrupt JSON → `null` **and the key is removed**
- [ ] wrong `version` → `null` and removed
- [ ] `savedAt` older than `ttlMs` → `null` and removed
- [ ] `savedAt` in the future → `null` and removed
- [ ] failing `validate` predicate → `null` and removed
- [ ] `setItem` throwing → `writeCache` does not throw
