# Tech stack

Confirmed stack for the FIB front-end task. Coding rules: [../AGENT.md](../AGENT.md).
Detailed per-area plans: [FE/](FE/) and [BE/](BE/).

> **Changes from the first pass:** React **19** (was 18), and there **is** a small backend
> (the first pass concluded none was needed). Both applied throughout the plan.
>
> **⚠ Versions here are the *choices*; for what is actually installed see
> [phase-0-outcome.md](phase-0-outcome.md).** The current Vite template ships newer
> tooling than planned (Vite 8, TypeScript 6, Vitest 5) plus a few decisions that only
> surfaced at install time — ESLint pinned to 9, `shared/` reduced to types-only.

---

## Frontend

| Concern | Choice | Notes |
|---|---|---|
| Language | **TypeScript 5.x** → ES2022 JS | `strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` |
| UI library | **React 19** (`react`, `react-dom`) | |
| Types | `@types/react@19`, `@types/react-dom@19` | must match the major, or `ReactNode` mismatches appear |
| Build / dev server | **Vite 7** + `@vitejs/plugin-react` | needs Node ≥ 20.19 or ≥ 22.12 |
| Routing | **react-router-dom 7.x** | declarative `<Routes>` mode only — see below |
| **State management** | **React Context + `useContext`** | no Redux, no RTK, no Zustand — see below |
| **Auth** | **JWT access token in memory + `httpOnly` refresh cookie** | full token lifecycle with silent refresh — see [auth.md](auth.md) |
| **Validation** | **Joi 17** (`joi`) | schema-based; the login schema is shared with the backend |
| **Data table** | **TanStack Table v8** (`@tanstack/react-table`) | headless — we keep our own markup and SCSS |
| Data fetching | `fetch` + a `useReducer` state machine in `usePeople` | no react-query |
| Styling | **SCSS + CSS Modules** (`*.module.scss`), `sass` (Dart Sass) | `@use` only, never `@import` |
| Client storage | `localStorage` (page cache only) | browser-native, no wrapper library. **No token goes in web storage** — see the auth section |
| Linting | ESLint 9 flat config, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | rules from AGENT.md §7 |
| Formatting | Prettier | |
| Tests | Vitest + jsdom (+ Testing Library if time allows) | only `lib/validation.ts` and `lib/cache.ts` in the first pass |

### Router: v7, declarative mode

react-router-dom 7 is the current major and is the version aligned with React 19. We use
only its **declarative** API — `<BrowserRouter>`, `<Routes>`, `<Route>`, `<Navigate>`,
`useNavigate`, `useSearchParams` — which is unchanged from v6, so nothing in
[FE/02-routing-auth.md](FE/02-routing-auth.md) needs rewriting.

We are **not** using v7's framework/data mode (loaders, actions, `createBrowserRouter`,
file-based routes). It's the right tool for real data routing; here it would add a router
config layer to move two `useEffect`-free screens around. AGENT.md §2.

### State management: Context, explicitly

Confirmed: **`createContext` + `useContext`**, nothing else.

| State | Where it lives |
|---|---|
| `isAuthenticated` / `user` | `AuthContext` — the one global. ~30 lines. |
| Current page's people, load status, error | `usePeople(page)` — a `useReducer` inside `TablePage`. Never leaves the subtree. |
| Which page is showing | the **URL** (`?page=N` via `useSearchParams`) — single source of truth, no mirroring state |
| Form values, touched flags | `useState` in `LoginForm` |
| Online / offline | `useOnlineStatus` hook (promoted to a second small context only if a second consumer appears) |

No Redux, no RTK, no Zustand, no Jotai. There is exactly one piece of genuinely global
state and it is one boolean plus a username. A store would add a dependency, a provider,
slices, and a serialization boundary to manage that. The two `useMemo`-wrapped context
values are the entire "state management layer".

The one Context rule that matters: **memoize the provider value**
(`useMemo`), or every provider render hands consumers a new object identity and defeats
the point. Covered in [FE/02-routing-auth.md](FE/02-routing-auth.md).

### Validation: Joi

`joi@^17` — schema-based validation, used on **both sides**:

| Where | Schema | Used for |
|---|---|---|
| FE | `loginSchema` | the login form's 4–30-character rules |
| FE | `peoplePageSchema` | validating a `localStorage` cache payload before trusting it |
| BE | `peopleQuerySchema` | validating `?page=N` |

Schemas live in `shared/src/schemas.ts` where both sides need them, so the rules exist
once. Key usage details:

```ts
export const loginSchema = Joi.object({
  username: Joi.string().trim().min(4).max(30).required(),
  password: Joi.string().min(4).max(30).required(),   // no .trim() — deliberate
});

const { error } = loginSchema.validate(values, { abortEarly: false, convert: true });
```

- **`abortEarly: false` is mandatory here.** Joi's default stops at the first failure, so
  a form with two bad fields would only ever report one — and the user would fix one
  error at a time. This is the single easiest Joi mistake to make.
- **`.trim()` on username only.** With `convert: true` (Joi's default) `.trim()` actually
  transforms the value, which is exactly the username behaviour we want; a password's
  leading/trailing spaces are legitimate characters and must survive. Same asymmetry as
  before, now expressed in the schema instead of in hand-written code
  ([FE/03-login-form.md](FE/03-login-form.md)).
- **Validation stays synchronous.** `schema.validate()` is sync (`validateAsync` is the
  async one, and we don't use it), so `errors` and `canSubmit` are still derived during
  render — no `useEffect`, no async form state.
- `error.details` is an array; a small `toFieldErrors` mapper turns it into
  `{ username?: string, password?: string }` keyed by `detail.path[0]`.
- Custom messages via `.messages({ 'string.min': '…' })` so the UI copy isn't Joi's
  default `"username" length must be at least 4 characters long`.

**Honest note on cost:** Joi is a server-first library and is heavy for a browser bundle
(~40 KB gzipped) — for two fields, hand-written validation would have been ~30 lines and
free. What it buys, and why it's a reasonable call now that a backend exists: one schema
definition instead of two implementations of the same rules, and the same library
validating the cache payload and the API query. If bundle size later matters, the schema
is isolated in `lib/validation.ts` and swapping to Zod (~8 KB) is a contained change.

### Data table: TanStack Table

`@tanstack/react-table@^8` — headless, which is why it fits: it computes rows, columns
and header groups, and **we still emit our own `<table>` markup**. So everything in
[FE/07-styling.md](FE/07-styling.md) survives intact — the semantic `<table>`, the sticky
header, and the CSS-only mobile card layout.

```ts
const columnHelper = createColumnHelper<Person>();

export const peopleColumns = [
  columnHelper.accessor('name',      { header: 'Name',       meta: { label: 'Name' } }),
  columnHelper.accessor('mass',      { header: 'Mass',       meta: { label: 'Mass' },
                                       cell: (info) => formatMass(info.getValue()) }),
  columnHelper.accessor('height',    { header: 'Height',     meta: { label: 'Height' },
                                       cell: (info) => formatHeight(info.getValue()) }),
  columnHelper.accessor('hairColor', { header: 'Hair color', meta: { label: 'Hair color' },
                                       cell: (info) => <ColorSwatch value={info.getValue()} /> }),
  columnHelper.accessor('skinColor', { header: 'Skin color', meta: { label: 'Skin color' },
                                       cell: (info) => <ColorSwatch value={info.getValue()} /> }),
];
```

Three details that matter:

- **`manualPagination: true`, and no `getPaginationRowModel()`.** Our pagination is
  server-side ([FE/04-table-page.md](FE/04-table-page.md)); letting TanStack also page
  the 10 rows it was given would paginate a single page. Only `getCoreRowModel()` is
  wired up. Our own `Pagination` component keeps driving `?page=N`.
- **`meta.label` feeds `data-label`** on each `<td>`, which is what the mobile card
  layout's `::before` reads. That keeps the responsive table working with zero extra DOM.
- **The name cell stays `<th scope="row">`.** TanStack doesn't emit markup, so we choose
  the element per cell — one check on `cell.column.id` in the row renderer. Preserves the
  row-header semantics screen readers need.

**Honest note on cost:** for 5 fixed columns and 10 rows this is more machinery than
`people.map()` (AGENT.md §2 territory). What it buys: typed column definitions tied to
`Person`, formatting co-located with each column instead of scattered through JSX, and
sorting/filtering as a one-line addition (`getSortedRowModel()`) rather than a rewrite.
~14 KB gzipped.

---

## Backend

Deliberately tiny: **JSON files loaded into memory at boot, served read-only.**
No database, no ORM, no migrations, no Docker, no auth server. Full plan in
[BE/README.md](BE/README.md).

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Node.js 22 LTS** | 20.19+ also fine; Vite 7 sets the floor |
| Language | **TypeScript**, run with `tsx` in dev | `tsx` = one dev dep, zero config, watch mode |
| HTTP framework | **Express 5** | boring and universally readable for a handful of endpoints |
| Validation | **Joi 17** | `?page=N` and the login body; same library as the FE |
| **JWT** | **`jose`** | ESM-native, zero-dependency, typed — the server is `"type": "module"`, so `jsonwebtoken` (CJS + `@types`) is the worse fit |
| **Sessions** | **in-memory `Map`, refresh tokens stored hashed** | same reasoning as the people store; revocable, and never holds a usable secret |
| **Secret** | **`JWT_SECRET` from `server/.env`** | no `dotenv` — Node 22 loads it natively via `--env-file`. The server refuses to boot without it |
| Cookies | `cookie-parser` | Express 5 has no built-in cookie parsing |
| CORS | `cors` middleware, `credentials: true` | the FE runs on `:5173`, the API on `:3001`; credentials forbid `origin: '*'`, which we already avoid |
| Data store | **`server/data/people.json`, read once at boot into a frozen in-memory array** | `readFileSync` + `JSON.parse` at module init |
| Persistence | **none** | read-only API; nothing is ever written, so nothing needs saving |
| Build | `tsc` for a `dist/`, or just run `tsx src/index.ts` | not deployed, so `tsx` is enough |

Total backend dependencies: **`express`, `cors`, `joi`, `jose`, `cookie-parser`**
(+ `typescript`, `tsx`, `@types/*` in dev).

### Auth: JWT + sessions + refresh

Requested, and designed in full in **[auth.md](auth.md)**. The shape:

| | Access token | Refresh token |
|---|---|---|
| Format | JWT (HS256), 15 min | opaque 32 random bytes, 1 day |
| Stored client-side | **memory only** | **`httpOnly` cookie** |
| Stored server-side | nothing | SHA-256 hash in the session `Map` |
| Revocable | no — hence the short TTL | yes, which is the point |

Endpoints: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`,
`GET /api/auth/me`. `GET /api/people` gains `requireAuth`.

Three decisions worth stating here because they are the ones that get done wrong:

- **The access token never touches `localStorage`.** Anything readable there is a usable
  bearer credential for any script on the origin. It lives in a module variable, dies with
  the tab, and the `httpOnly` cookie carries the long-lived half — unreadable from JS.
- **The refresh token is opaque, not a JWT.** A JWT is verified by signature alone, so it
  cannot be revoked before expiry; that is fine for 15 minutes and wrong for a day. Opaque
  + a session lookup means logout actually invalidates it.
- **`AuthStatus` is a three-state union**, `'bootstrapping' | 'authenticated' | 'anonymous'`,
  not a boolean. Because the access token is in memory it is *always* absent at mount, so a
  boolean guard would redirect a signed-in user to the login page on every refresh. The
  union makes "don't know yet" representable, so waiting becomes the natural thing to write.

**Honest scope note:** there is still no user store, so any 4–30 character
username/password pair is accepted. What this adds is a real token lifecycle — issue,
verify, expire, refresh, rotate, revoke — replacing the `sessionStorage` boolean the login
flow was previously faking. The repo README says so plainly.

### Why in-memory JSON is the right call here

- The dataset is **87 immutable records, ~40 KB**. It fits in memory with room to spare
  and will never change.
- The API is **read-only**. There are no writes, so there is no durability requirement —
  which is the only reason a database would exist.
- **Not being redeployed**, so no migration story, no connection pooling, no backups.
- A `Map`/array + `.slice()` *is* the query engine. Pagination is
  `people.slice((page - 1) * pageSize, page * pageSize)`.

A DB here would mean a schema, a client, a connection lifecycle, a seed script, and a
running service — all to `SELECT * LIMIT 10 OFFSET n` from a fixed 87-row table.

### Endpoints

```
GET /api/people?page=N   → { count, next, previous, results[] }   ← SWAPI's exact shape
GET /api/health          → { status: 'ok', peopleLoaded: 87 }
```

Two. That's the whole surface. Page size is fixed at 10 with no `pageSize` parameter —
SWAPI has none, and identical behaviour from both data sources is worth more than a knob
with no caller. Full rationale in [BE/README.md](BE/README.md).

---

## Shared between FE and BE

**npm workspaces** (built into npm, no extra tool) with a `shared/` package holding the
**wire contract** — `SwapiPersonDto` and `SwapiPageDto`, the snake_case shape that goes
over HTTP. One `npm install` at the root, and the FE and BE cannot drift on the response
shape. That shared contract is the main thing having a backend actually buys us.

Note what is **not** shared: the camelCase `Person` / `PeoplePage` UI models stay in
`client/src/types/api.ts`. They're the FE's internal representation, produced by the
FE's mapper. Sharing them would let a change in how the UI wants its data ripple into
the server's contract, which is backwards.

```
FB-task/
├─ package.json          workspaces: ["client", "server", "shared"] + root dev scripts
├─ AGENT.md
├─ plan/
├─ shared/               @fib/shared — the FE/BE contract
│  ├─ package.json       depends on joi
│  └─ src/
│     ├─ types.ts        SwapiPersonDto, SwapiPageDto
│     └─ schemas.ts      loginSchema, peopleQuerySchema (Joi)
├─ client/               the React app (everything in FE/00-architecture.md)
└─ server/               the Express API (everything in BE/README.md)
```

`shared/` now carries runtime code (the Joi schemas), not just types — so it needs a real
build or, simpler, to be consumed as TypeScript source via the workspace symlink with
`client` and `server` compiling it themselves. Verify which in Phase 0.

**Fallback if workspaces cause friction:** keep `shared/` for nothing, and put
`loginSchema` in `client/src/lib/validation.ts` and `peopleQuerySchema` in
`server/src/routes/schemas.ts`, duplicating the two wire interfaces (~12 lines). The FE
and BE then validate different things anyway — login is FE-only, the query is BE-only —
so the duplication is smaller than it first looks. Decided in Phase 0, not litigated later.

Root scripts:

```jsonc
{
  "scripts": {
    "dev": "npm run dev --workspace=server & npm run dev --workspace=client",
    "dev:client": "npm run dev --workspace=client",
    "dev:server": "npm run dev --workspace=server",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

The `&` in `dev` is POSIX-only. On Windows either run the two `dev:*` scripts in two
terminals, or add `concurrently` as a root dev dep — one dependency, and it gives
prefixed, colour-coded output plus a single Ctrl-C. **Recommended**, since this project
is being developed on Windows.

---

## One decision that needs your call

The task text says, literally:

> *Fetch data from the Star Wars API (https://swapi.py4e.com/api/people)*

So requirement 6 names that URL. If the FE points at our own backend instead, a reviewer
reading the requirement list could mark it unmet.

**Recommendation — support both, with one env var:**

```
client/.env.development   VITE_API_BASE_URL=http://localhost:3001/api   # our backend
client/.env.production    VITE_API_BASE_URL=https://swapi.py4e.com/api  # literal compliance
```

`services/constants.ts` reads it; **nothing else in the app changes**, because the service
layer already isolates the URL and maps the response. The backend serves the identical
shape, so both paths hit the same mapper.

This gets us all three things: literal compliance with requirement 6 in the submitted
build, the backend you asked for, and a demo that still works if SWAPI is down on review
day. The README documents both modes.

If you'd rather the backend be the only data source, that's a one-line change to the
default — say so and I'll flip it.

---

## Deliberately not using

| Not using | Because |
|---|---|
| Redux / RTK / Zustand / Jotai | one boolean of global state; Context is the whole requirement |
| TanStack Query / SWR | one resource, one endpoint; `usePeople` is ~40 lines. First thing I'd add if the app grew |
| Any database (Postgres, SQLite, Mongo) | 87 immutable read-only records, no redeploy |
| Prisma / Drizzle / any ORM | there is no schema to map |
| Docker / docker-compose | two `npm run dev` processes |
| Tailwind / MUI / Chakra / Bootstrap | SCSS Modules were specified; a component library would also make "visually appealing" someone else's work |
| Zod / io-ts / Yup | **Joi** fills this role — one validation library, not two |
| `react-table` v7, MUI DataGrid, AG Grid | **TanStack Table v8** is the maintained successor to v7; the styled grids would take over the visual design |
| `axios` | `fetch` is native and we need a thin wrapper anyway for timeout + abort |
| `focus-trap-react`, `react-modal` | the `Modal` primitive is ~60 lines and we need custom offline behaviour regardless |
| Passport / NextAuth / Auth0 | four endpoints and ~150 lines; a strategy framework would be larger than what it configures |
| `bcrypt` / `argon2` | there is no stored password to hash — no user store. Refresh tokens are SHA-256'd because they are random secrets, not low-entropy passwords |
| `dotenv` | Node 22 loads `.env` natively with `--env-file` |
| `express-session` | it wants a cookie-backed session store; we need a token lifecycle, and the session `Map` is ~30 lines |
| CRA (`create-react-app`) | deprecated |
| `node-sass` | dead; Dart Sass (`sass`) only |

---

## React 19 specifics that change how we write code

Worth knowing up front, because three of these make the plan *simpler* than the React 18
version:

1. **`forwardRef` is gone — `ref` is a normal prop.** The `Input` and `Button` primitives
   take `ref` directly:
   ```tsx
   export const Input = ({ ref, label, error, ...rest }: InputProps) => …
   ```
   No `forwardRef` wrapper, no `ForwardedRef<HTMLInputElement>` type gymnastics.
2. **`<Context>` can be rendered directly as the provider:**
   ```tsx
   <AuthContext value={value}>{children}</AuthContext>   // not <AuthContext.Provider>
   ```
   `.Provider` still works and isn't removed; we use the short form for consistency.
3. **Ref callbacks may return a cleanup function.** Convenient — but it means an implicit
   arrow return is now a **type error**:
   ```tsx
   ref={(element) => (inputRef.current = element)}      // ❌ returns a value
   ref={(element) => { inputRef.current = element; }}   // ✅
   ```
   Easy to trip over when porting habits from 18.
4. **`useId` format changed** and is opaque. Never parse it, never assert on it in a
   test, never build a CSS selector from it. We only pass it to `htmlFor` / `aria-describedby`.
5. **Removed in 19:** `propTypes`, `defaultProps` on function components, string refs,
   legacy context, `ReactDOM.render`, `ReactDOM.hydrate`, `react-test-renderer` shallow.
   We use none of them — but any snippet copied from an older tutorial may.
6. **`useActionState` / `useFormStatus` / `useOptimistic` / `use()`** — real additions, and
   deliberately unused here. Our login submit is synchronous with nothing to await, so
   `useActionState` would add an async state machine around a function that just calls
   `login()` and `navigate()`. AGENT.md §2.
7. **StrictMode still double-invokes effects in dev.** So the `AbortController` cleanup in
   `usePeople` isn't optional — without it you'll see two requests per page and can get
   the late-response race. Already planned in [FE/04-table-page.md](FE/04-table-page.md).

---

## Version pinning

Take whatever `npm create vite@latest` and `npm i react@19` resolve to, then **commit the
lockfile and record the exact versions in the repo README**. The plan names majors
(React 19, Router 7, Express 5, Vite 7) because those are the choices; exact patch
versions are whatever install day gives, and the lockfile is the record.

Floor to verify in Phase 0: `node --version` ≥ 20.19 (Vite 7's requirement).
