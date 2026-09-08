# Phase 1 · Outcome

Status: **complete and verified.** The server boots, serves 87 records over 9 pages, and
its response shape matches live SWAPI exactly.

Built to [BE/README.md](BE/README.md). Only one deviation, noted below.

## What runs

```bash
npm run dev:server        # tsx watch → http://localhost:3001/api
npm run snapshot          # one-off: refetch server/data/people.json
npm run dev               # concurrently: server + client (now that both exist)
```

```
server/
├─ tsconfig.json                 nodenext, noEmit, strict (matches the client)
├─ eslint.config.js              imports the shared rules from ../eslint.rules.js
├─ data/people.json              87 records, 61 KB, committed
├─ scripts/fetchSnapshot.ts      one-off dev tool, never in the request path
└─ src/
   ├─ index.ts                   boot + listen
   ├─ app.ts                     cors → routers → 404 → error handler
   ├─ config.ts                  PORT, CORS_ORIGIN, PUBLIC_BASE_URL, PAGE_SIZE
   ├─ types.ts                   re-exports @fib/shared + ApiErrorBody
   ├─ store/peopleStore.ts       readFileSync + Object.freeze at module init
   ├─ routes/peopleRoutes.ts     GET /api/people
   ├─ routes/healthRoutes.ts     GET /api/health
   ├─ routes/schemas.ts          Joi peopleQuerySchema
   └─ middleware/errorHandler.ts notFoundHandler + errorHandler
```

## Shape parity with SWAPI — verified, not assumed

The whole "one-line env switch" design rests on this, so it was diffed against the live
API rather than eyeballed:

| Checked against `swapi.py4e.com/api/people/?page=2` | Result |
|---|---|
| Top-level keys | ✅ `count,next,previous,results` |
| Record keys (all 16, not just the 5 we render) | ✅ identical |
| `count` | ✅ 87 |
| Record order within the page | ✅ identical |
| `name` / `height` / `mass` / `hair_color` / `skin_color` / `url` | ✅ identical values |
| `next` / `previous` | ⚠️ point at `localhost:3001` **by design** |

`url` being preserved verbatim matters more than it looks: the client derives its row `id`
from that field, so ids are identical whichever source is used. Had the server rewritten
`url` to itself, cache keys and React row keys would silently differ between modes.

## Endpoint behaviour — every case from the plan's table

| Request | Expected | Actual |
|---|---|---|
| `/api/health` | 200 + loaded count | ✅ `{"status":"ok","peopleLoaded":87}` |
| `/api/people` (no page) | 200, page 1 | ✅ |
| `/api/people/` (slashed) | 200 | ✅ both spellings registered |
| `?page=1` | 10 records, `previous: null` | ✅ |
| `?page=8` | 10 records, both links set | ✅ |
| `?page=9` | **7** records (87 = 8×10+7), `next: null` | ✅ |
| `?page=99` | 200, `results: []`, real `count` | ✅ |
| `?page=abc` / `0` / `-3` / `1.5` | 400 `INVALID_PAGE` | ✅ all four |
| `?page=2&bogus=zzz` | 200 — stray params ignored | ✅ `stripUnknown` |
| `/api/nope` | 404 `NOT_FOUND`, same envelope | ✅ |
| CORS from `localhost:5173` | header present, not `*` | ✅ |
| Missing snapshot | fail at boot, actionable message | ✅ exit 1 |
| Empty snapshot | fail at boot, actionable message | ✅ exit 1 |

`.integer()` is what rejects `1.5` — a bare `Number()` check would have accepted it.

## Two things the code got right only after the type checker objected

### Joi's `ValidationResult` is a discriminated union

The plan's snippet destructured up front:

```ts
const { value, error } = peopleQuerySchema.validate(request.query, { … });
```

That fails `@typescript-eslint/no-unsafe-assignment`. Joi types the result as
`{ error: undefined; value: TSchema } | { error: ValidationError; value: any }`, so
destructuring both keys at once unions `value` down to `any` — the typed schema buys
nothing. Narrow first:

```ts
const result = peopleQuerySchema.validate(request.query, { … });
if (result.error) { /* 400 */ return; }
const { page } = result.value;   // PeopleQuery
```

Worth knowing before Phase 3, where the login form validates the same way.

### `shared/` needed an explicit file extension

`shared/src/index.ts` had `export type * from './types'`. The client resolves that fine
(`moduleResolution: bundler`), but the server is `nodenext`, which requires explicit
extensions — `TS2835`. Changed to `'./types.js'`, which both resolutions accept.

The lesson for the workspace: **`shared/` must satisfy the strictest consumer**, so it is
written Node-ESM style even though only the server needs that.

## Deviation from the plan

**No `dist/`, no `start` script.** `server/tsconfig.json` sets `noEmit: true` and `build`
is a plain `tsc` type-check. The plan already said a `dist/` was only there so CI could
type-check; making that explicit removed a `rootDir`/`outDir` question (`scripts/` is in
the same project for linting, and would otherwise have emitted to `dist/scripts/`,
pushing the entry point to `dist/src/index.js`). Dev runs through `tsx`. Nothing is
deployed, so nothing needs emitting.

## Also done

- **`eslint.rules.js` at the repo root** — the AGENT.md rule block, imported by both
  `client/eslint.config.js` and `server/eslint.config.js`. Previously inline in the
  client config; two workspaces would have meant two copies drifting apart.
- **`@typescript-eslint/no-unused-vars` now honours a leading underscore**, matching what
  `noUnusedParameters` already did. Needed because Express identifies error middleware by
  its four-parameter arity, so `_next` must exist unused.
- **Root scripts restored**: `dev` runs both workspaces via `concurrently`, plus
  `dev:server` and `snapshot` passthroughs.

## Verified

- [x] `npm run build` — client bundle + server type-check, both clean
- [x] `npm run lint` — 0 errors, 0 warnings across both workspaces at `--max-warnings 0`
- [x] `npm test` — 2 passing (client)
- [x] `npx prettier --check .` — clean
- [x] Server boots in ~1s, logs `87 people loaded, 9 pages of 10`
- [x] All 13 endpoint cases above
- [x] Snapshot contains the edge cases Phase 4 needs: Jabba's `mass: "1,358"`,
      28 records with `mass: "unknown"`, 5 with `hair_color: "n/a"`

## Not done

- `git init` happened at the start of this phase; three commits exist on `main`
  (docs, phase-0, phase-1). **No remote, nothing pushed.**
- `VITE_API_BASE_URL` env files — Phase 4, with the service layer. Default stays **SWAPI**.
- No server tests. The store is 3 pure functions over a frozen array and the route is one
  handler; the 13 verified cases above cover it, and the plan's testing budget is spent on
  `validation.ts` and `cache.ts`. Revisit if the API grows.
