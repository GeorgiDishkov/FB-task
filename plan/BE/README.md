# BE · Minimal in-memory JSON API

**Decision (supersedes the first pass, which concluded no backend was needed):** build a
tiny read-only Express API that loads a JSON snapshot into memory at boot and serves it
paginated, plus a token-based auth layer. No database, no ORM, no on-disk persistence,
no Docker.

Stack summary: [../tech-stack.md](../tech-stack.md) · Coding rules: [../../AGENT.md](../../AGENT.md)

---

## Scope

| Does | Does not |
|---|---|
| Serve 87 Star Wars people, paginated 10 at a time | Write, update or delete anything |
| Mirror the SWAPI response shape exactly | Talk to a database |
| **Verify credentials against a seeded, scrypt-hashed account** | Register users, reset passwords, or store more than one row |
| **Issue, verify, refresh and revoke tokens** | Rate-limit, log to a service, or run in a container |
| Set CORS for the Vite dev origin, with credentials | Persist anything across a restart |

Runtime dependencies: `express`, `cors`, `joi`, `jose`, `cookie-parser`.

> **Auth was added after this document's first version**, which had concluded a login
> endpoint would be theatre. That decision is reversed — see [../auth.md](../auth.md) for
> the full design and [../AUDIT.md](../AUDIT.md) for the reversal record. The endpoints
> below are the data half; auth lives in its own doc because it is the larger half.

## The one design decision that makes this clean

**The API returns SWAPI's exact wire shape** — `count`, `next`, `previous`, `results[]`
with snake_case fields — not our camelCase UI model.

```json
{
  "count": 87,
  "next": "http://localhost:3001/api/people/?page=2",
  "previous": null,
  "results": [
    { "name": "Luke Skywalker", "height": "172", "mass": "77",
      "hair_color": "blond", "skin_color": "fair", "url": "…/people/1/" }
  ]
}
```

Because of that, `VITE_API_BASE_URL` is a **genuine one-line switch**: the FE's single
`mapPeoplePage` DTO→model mapper works against SWAPI and against us, with no branching,
no second code path, and no `if (usingLocalBackend)` anywhere. See the open decision in
[../tech-stack.md](../tech-stack.md).

The alternative — serving pre-mapped camelCase — would look tidier in isolation and force
the FE to carry two mappers. Wrong trade.

**Page size is fixed at 10, with no `pageSize` parameter.** SWAPI has none, the FE never
wants another value, and adding one would be a parameter with no caller (AGENT.md §2).
Identical behaviour from both sources is worth more than a knob.

## Endpoints

### `GET /api/people?page=N`

| Case | Response |
|---|---|
| `page` omitted | treated as `1` |
| `page` is a positive integer within range | `200` with the shape above |
| `page` beyond the last page | `200`, `results: []`, correct `count` / `next: null` |
| `page` not a positive integer (`abc`, `0`, `-3`, `1.5`) | `400` `{ "error": { "code": "INVALID_PAGE", "message": "…" } }` |

Out-of-range returns an empty page rather than `404` so the client can recover from the
body (it already has `count` and can clamp). Malformed input is a `400` because that's a
caller bug, not an empty result.

> Note: SWAPI answers an out-of-range page with `404 {"detail":"Not found"}`. We
> deliberately differ, and the FE clamps the page before requesting either way
> ([../FE/04-table-page.md](../FE/04-table-page.md)), so neither path is hit in normal use.

### `GET /api/health`

`200 { "status": "ok", "peopleLoaded": 87 }` — one line, and it's how you confirm the
snapshot actually loaded without opening the data endpoint.

## Structure

```
server/
├─ package.json
├─ tsconfig.json
├─ eslint.config.js            imports the shared rules from ../eslint.rules.js
├─ .env                        JWT_SECRET + token TTLs (gitignored)
├─ .env.example                the documented contract (committed)
├─ data/
│  └─ people.json              the committed snapshot: { "count": 87, "results": [ … ] }
├─ scripts/
│  └─ fetchSnapshot.ts         one-off: pull all 9 SWAPI pages → data/people.json
└─ src/
   ├─ index.ts                 boot: load store, start listening
   ├─ app.ts                   express app: cors → cookies → routers → 404 → errors
   ├─ config.ts                PORT, CORS_ORIGIN, PAGE_SIZE, PUBLIC_BASE_URL, JWT_SECRET, TTLs
   ├─ types.ts                 re-exports the shared wire types + ApiErrorBody
   ├─ store/
   │  └─ peopleStore.ts        load JSON once at boot; getPeopleSlice(page)
   ├─ auth/                    see ../auth.md
   │  ├─ tokens.ts             sign / verify access JWT, mint refresh tokens
   │  ├─ sessionStore.ts       in-memory Map, refresh tokens stored hashed
   │  ├─ authService.ts        login / refresh / logout
   │  └─ types.ts              AuthUser, SessionRecord, TokenPair
   ├─ routes/
   │  ├─ peopleRoutes.ts       GET /api/people   (requireAuth)
   │  ├─ healthRoutes.ts       GET /api/health
   │  ├─ authRoutes.ts         POST login / refresh / logout, GET me
   │  └─ schemas.ts            Joi peopleQuerySchema + loginSchema
   └─ middleware/
      ├─ requireAuth.ts        Bearer → request.auth, or 401
      └─ errorHandler.ts       404 catch-all + last-resort 500
```

Same folder-per-concern discipline as the FE, minus the component rules (there are no
components). AGENT.md §1–3 apply in full: whole words, no nesting, no speculative options.

## The store — "in memory" concretely

```ts
// src/store/peopleStore.ts
import { readFileSync } from 'node:fs';
import { PAGE_SIZE } from '../config.js';
import type { SwapiPersonDto } from '../types.js';

interface SnapshotFile {
  results: SwapiPersonDto[];
}

const loadPeople = (): readonly SwapiPersonDto[] => {
  const fileContents = readFileSync(SNAPSHOT_PATH, 'utf8');
  const snapshot = JSON.parse(fileContents) as SnapshotFile;

  if (!Array.isArray(snapshot.results)) {
    throw new Error(`Snapshot at ${SNAPSHOT_PATH} has no results array.`);
  }

  return Object.freeze(snapshot.results);
};

// read once, at module init — this is the entire "database"
const people = loadPeople();

export const getTotalCount = (): number => people.length;

export const getPeopleSlice = (page: number): readonly SwapiPersonDto[] =>
  people.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

- **`readFileSync` at module init, deliberately.** It runs once, before the server
  accepts a connection, so there is nothing to make async. An async loader here would
  add a promise and a readiness flag to save nothing.
- **`Object.freeze`** so a route handler can't mutate the dataset by accident. It's the
  whole store; there's no second copy to fall back on.
- **A bad or missing snapshot throws at boot**, not on the first request. Fail loudly at
  startup rather than serving 500s later.
- No cache layer. The data is already in memory — a cache in front of RAM is a joke
  about caching.

## The route

Query validation is a **Joi schema**, the same library the FE validates with:

```ts
// src/routes/schemas.ts  (server-only: the client has no use for it)
export interface PeopleQuery {
  page: number;
}

export const peopleQuerySchema = Joi.object<PeopleQuery, true>({
  page: Joi.number().integer().min(1).default(1),
});
```

Typing the schema as `Joi.object<PeopleQuery, true>` makes `value` come back as
`PeopleQuery`, so the handler needs no cast — the `true` marks it as fully validated.
Untyped, `value` is `any` and every read silently opts out of the type system.

`Joi.number()` with `convert: true` (the default) turns the `"2"` that Express hands us
into `2`, so the handler never parses a string itself. `.default(1)` covers the omitted
case. `"abc"`, `"0"`, `"-3"` and `"1.5"` all fail — `.integer()` is what rejects `1.5`,
which a bare `Number()` check would have let through.

Flat, guard-clause style per AGENT.md §3:

```ts
// src/routes/peopleRoutes.ts
export const getPeopleHandler = (request: Request, response: Response): void => {
  const result = peopleQuerySchema.validate(request.query, {
    convert: true,
    stripUnknown: true,   // ignore stray query params rather than 400-ing on them
  });

  if (result.error) {
    response.status(400).json({
      error: { code: 'INVALID_PAGE', message: 'page must be a positive integer.' },
    });
    return;
  }

  // Joi ValidationResult is a discriminated union: value is only typed as PeopleQuery
  // once error is narrowed to undefined. Destructuring both up front collapses it to any.
  const { page } = result.value;
  const totalCount = getTotalCount();
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  response.json({
    count: totalCount,
    next: page < totalPages ? buildPageUrl(page + 1) : null,
    previous: page > 1 ? buildPageUrl(page - 1) : null,
    results: getPeopleSlice(page),
  });
};
```

`next` / `previous` are generated even though the FE ignores them (it derives page count
from `count`). They're part of the shape we're mirroring, and omitting them would break
the "identical to SWAPI" contract for a saving of three lines.

## The snapshot script

```
npx tsx scripts/fetchSnapshot.ts
```

Fetches `https://swapi.py4e.com/api/people/?page=1..9`, concatenates `results`, writes
`data/people.json`. **Run once; commit the output.** Roughly 25 lines.

Committing the data (~40 KB) rather than fetching at boot is the point: the backend then
has no network dependency at all, starts instantly, and works with the Wi-Fi off — which
is also what makes the offline demo in [../FE/06-offline-and-errors.md](../FE/06-offline-and-errors.md)
reproducible.

The script is a dev tool, not part of the server. It never runs in the request path.

## Config

```ts
// src/config.ts
export const PORT = Number(process.env.PORT ?? 3001);
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}/api`;
export const PAGE_SIZE = 10;
```

CORS is restricted to the Vite dev origin rather than `*`. It costs one option and it's
the correct default even for something that isn't deployed.

`PAGE_SIZE` is a constant, not an env var — it's fixed by the contract we're mirroring,
not a deployment concern.

## Error handling

- One Express error-handling middleware, registered last, returning
  `500 { error: { code: 'INTERNAL', message: 'Unexpected server error.' } }` and logging
  the real error server-side. Never leak a stack trace in the body.
- A `404` catch-all for unknown paths, in the same envelope shape as every other error, so
  the client has one error format to parse.
- Express 5 forwards rejected promises from async handlers to the error middleware
  automatically (this is the main practical reason for 5 over 4) — but our handlers are
  synchronous anyway.

## Running it

```bash
npm run dev --workspace=server     # tsx watch src/index.ts  → http://localhost:3001
curl http://localhost:3001/api/health
curl "http://localhost:3001/api/people?page=2"
```

No build step needed in dev. `npm run build --workspace=server` (`tsc`) exists so the
type check runs in CI, not because a `dist/` gets deployed.

## What's still explicitly out of scope

- **A user store.** ~~Login endpoint~~ — *superseded, see [../auth.md](../auth.md).* Auth
  endpoints now exist, but there are still no stored users: any username/password pair
  passing the 4–30 character rules is accepted. Inventing credentials the task never
  specified would make the demo harder to review, not more honest. The token *lifecycle*
  is real; the credential check is not, and the README says so.
- **Writes of any kind.** No favourites, no edits. Nothing in the task asks for it, and
  the moment something is writable, "in memory with no persistence" becomes a bug rather
  than a decision. (Sessions are the one exception, and they are deliberately ephemeral —
  a server restart signs everyone out.)
- **Serving the built FE.** Vite dev serves the client; two processes is simpler than
  wiring static hosting into an API that isn't deployed.

## Decision record

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-04 | *(superseded)* No backend — FE calls SWAPI directly | Public CORS-enabled read-only API; nothing for a BE to do |
| 2026-09-04 | **Small Express + in-memory JSON backend** | Requested. Also removes the third-party availability risk from the demo and gives FE/BE a shared, version-controlled response contract |
| 2026-09-04 | **API mirrors SWAPI's wire shape** (snake_case, `count`/`next`/`previous`/`results`) | Makes the data source a one-line env switch with a single FE mapper |
| 2026-09-04 | **Fixed page size of 10, no `pageSize` param** | SWAPI has none; identical behaviour from both sources beats a knob with no caller (AGENT.md §2) |
| 2026-09-04 | *(superseded)* No DB, no persistence, no auth endpoint | 87 immutable read-only records, not being redeployed |
| 2026-09-08 | **JWT + in-memory sessions + refresh rotation** | Requested. No DB still: sessions live in a Map and are deliberately ephemeral. Design in [../auth.md](../auth.md) |
