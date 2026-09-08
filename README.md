# Star Wars Characters — FIB front-end task

A responsive React + TypeScript app: a validated login form that leads to a protected,
paginated table of Star Wars characters, with a localStorage cache, error handling and
an offline modal.

Task text as extracted from the PDF: [`plan/task-spec.txt`](plan/task-spec.txt).

---

## Run it

```bash
npm ci
cp server/.env.example server/.env    # then set JWT_SECRET (32+ chars)
npm run dev
```

That starts both workspaces — the API on `:3001` and the client on `:5173`.

Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

### Sign in

| Username | Password |
|---|---|
| `admin` | `Password1!` |

The account is seeded in `server/data/users.json` as a salted **bcrypt** hash (cost 12) —
the password is verified against it, not waved through.

Or create your own at **`/register`**. New accounts are appended to the same JSON store,
so they survive a restart and can log in afterwards.

### Other scripts

| Command | What it does |
|---|---|
| `npm run dev` | server + client together |
| `npm run dev:client` / `npm run dev:server` | one at a time |
| `npm run build` | type-check both workspaces, bundle the client |
| `npm run lint` | ESLint at `--max-warnings 0` |
| `npm test` | 95 tests across both workspaces |
| `npm run snapshot --workspace=server` | re-fetch `server/data/people.json` from SWAPI |
| `npm run seed:users --workspace=server` | reset the user store to just `admin` |

> **Use `npm ci`, not `npm install`, on a fresh clone.** npm 10.9's dependency resolver
> crashes while walking Vitest's optional-peer set when there is no lockfile. `npm ci`
> installs from the committed lockfile and is unaffected.

## Screenshots

<!--
  Drop four images in docs/screenshots/ and link them here:
    login-desktop.png · table-desktop.png · table-mobile.png · offline-modal.png
  Nobody should have to run npm install to see whether it looks good.
-->

---

## Requirements

All thirteen, with the file that implements each.

| # | Requirement | Where |
|---|---|---|
| 1 | Responsive login form, username + password | [`LoginForm.tsx`](client/src/pages/LoginPage/elements/LoginForm/LoginForm.tsx) |
| 2 | Both fields non-empty, 4–30 characters | [`lib/validation.ts`](client/src/lib/validation.ts) (Joi) |
| 3 | Login button disabled while invalid | [`LoginForm.tsx`](client/src/pages/LoginPage/elements/LoginForm/LoginForm.tsx) |
| 4 | `react-router-dom` navigation to `/table` | [`routes/`](client/src/routes) |
| — | *Extra:* registration at `/register` | [`RegisterPage/`](client/src/pages/RegisterPage) |
| 5 | `/table` page with a table | [`TablePage.tsx`](client/src/pages/TablePage/TablePage.tsx) |
| 6 | Fetch from the Star Wars API | [`services/swapi.ts`](client/src/services/swapi.ts) |
| 7 | Columns: name, mass, height, hair colour, skin colour | [`columns.tsx`](client/src/pages/TablePage/elements/PeopleTable/columns.tsx) |
| 8 | Pagination | [`Pagination/`](client/src/pages/TablePage/elements/Pagination) |
| 9 | Visually appealing and responsive table | [`PeopleTable.module.scss`](client/src/pages/TablePage/elements/PeopleTable/PeopleTable.module.scss) |
| 10 | Loading state | skeleton rows on a cold load, dimmed table on a page change |
| 11 | localStorage cache **with validation logic** | [`lib/cache.ts`](client/src/lib/cache.ts) |
| 12 | Error handling for failed requests | [`lib/errors.ts`](client/src/lib/errors.ts), [`ErrorState/`](client/src/pages/TablePage/elements/ErrorState) |
| 13 | Offline modal with an image | [`OfflineModal/`](client/src/components/OfflineModal) |

---

## Try the interesting bits

### The cache (requirement 11)

1. Load `/table`, then open **DevTools → Application → Local Storage**. You'll see
   `fib.swapi.people.v1.page.1` holding `{ version, savedAt, ttlMs, payload }`.
2. Reload. The badge next to the heading reads **"Cached · just now"** and the
   **Network tab shows no request** to the Star Wars API.
3. Now break the entry — any of these — and reload:
   - change `version` to `99`
   - set `savedAt` to ten minutes ago
   - set `savedAt` ten minutes into the *future*
   - change `totalCount` from `87` to `"87"` (a string)
   - replace the whole value with `not json`

   Each time the badge flips to **"Live"** and the bad entry is **deleted and refetched**.
   That is the "cache validation logic" the task asks for.
4. **"Refresh data"** clears every cached page and refetches.

### The offline modal (requirements 12–13)

1. Load `/table` and let page 1 finish.
2. **DevTools → Network → Offline.**
3. Click **Next** → the modal appears with its illustration, and the table you already
   loaded **stays readable behind it**.
4. Set throttling back to **No throttling** → the modal **closes by itself**.
5. Still offline, go back to a page you already visited → it **loads from the cache with
   no network at all**. This is where requirements 11 and 13 pay each other off.

### Token refresh

Set `ACCESS_TOKEN_TTL=30s` in `server/.env`, restart, sign in, wait half a minute, then
change page. DevTools shows exactly **one** `POST /api/auth/refresh` followed by the data
request — no visible interruption, and no second refresh even if several requests fail at
once.

---

## Architecture

Three npm workspaces, so one `npm ci` covers everything and the HTTP contract lives in
one place.

```
shared/     the wire contract (SwapiPersonDto, SwapiPageDto) — types only, no deps
server/     Express 5. JSON files read into memory at boot. Auth + the people endpoint
client/     React 19 + Vite + SCSS Modules
```

Inside `client/src`:

```
pages/            route-level views; each owns its sub-components in elements/
components/       shared across views only (ui/ holds the generic primitives)
hooks/            usePeople, useAuth, useOnlineStatus, useLockBodyScroll
context/           the single AuthContext
services/         the network boundary — the only place that knows API shapes
lib/              pure, framework-free helpers (validation, cache, format, errors)
styles/           SCSS tokens, mixins, breakpoints, global reset
```

**Dependencies run one way**: `pages → components → ui`, and
`pages/components/hooks → services → lib`. `lib/` imports nothing from the app and
`services/` imports no React, which is what makes them testable without a DOM.

Coding rules are written down in [`AGENT.md`](AGENT.md) and enforced by ESLint — whole-word
identifiers, no nesting deeper than one level, one folder per component, no speculative
abstraction. There are **zero `eslint-disable` comments** in the codebase; the two places
a rule was genuinely wrong are recorded in AGENT.md §8 instead.

Design notes and the full decision history are in [`plan/`](plan) —
[`AUDIT.md`](plan/AUDIT.md) is the change log, and each `phase-N-outcome.md` records what
was built, what was verified, and what turned out to be wrong.

---

## Decisions and trade-offs

**React Context, not Redux.** There is exactly one piece of genuinely global state — the
signed-in user. A store would add a dependency, a provider, slices and a serialisation
boundary to manage it. The current page's data never leaves `TablePage`, so it lives in a
`useReducer` hook. If this grew cross-resource caching or request dedup, **TanStack Query**
would be the thing to reach for, not Redux.

**The access token lives in memory; the refresh token is an `httpOnly` cookie.** Anything
in `localStorage` is a usable bearer credential for any script on the origin. The
consequence is that a page reload loses the access token — which is exactly what the
refresh endpoint is for. Neither `localStorage` nor `sessionStorage` ever holds a token.

**Passwords are hashed with bcrypt at cost 12.** The hash is self-describing and carries
its own salt (`$2b$12$<salt><digest>`), so there is no salt column to manage and raising
the cost later leaves existing rows verifiable. Note bcrypt silently truncates at 72
bytes — harmless here, since the schema caps passwords at 30 characters.

**Registration reuses the login 4–30 rule rather than inventing a stricter policy.**
Requirement 2 defines that rule for this app, and two different definitions of "a valid
password" — one to sign up with, another to sign in with — is a contradiction waiting to
confuse someone. What registration adds is a confirmation field, which catches a typo in
a value the user cannot see.

**The refresh token is opaque, not a JWT.** A JWT is verified by signature alone, so it
cannot be revoked before it expires — fine for 15 minutes, wrong for a day. An opaque
token checked against the session store means logout actually invalidates it. Replaying a
rotated token revokes the whole session.

**`AuthStatus` is a three-state union, not a boolean.** Because the access token is always
absent at mount, a boolean guard would bounce every signed-in user to the login page on
each refresh. `'bootstrapping' | 'authenticated' | 'anonymous'` makes "don't know yet"
representable, so waiting becomes the natural thing to write.

**Server-side pagination.** SWAPI already pages at 10/page (87 records → 9 pages), so the
client mirrors it rather than downloading everything and slicing locally. First paint after
one request, and each page gets its own cache entry.

**Values are formatted, never parsed.** Every API field is a string, including sentinels
like `"unknown"` and `"n/a"`, and Jabba's mass arrives as `"1,358"`. `Number()` on that is
`NaN`, so nothing goes through it — sentinels render as an em dash with the raw value in
`title`.

**Joi costs ~44 KB gzipped**, measured, to validate two form fields. Hand-written checks
would have been ~30 lines and free. What it buys: one schema definition covering the form,
the cache payload and the server's query params. It is isolated in `lib/validation.ts` if
it ever needs swapping.

**TanStack Table is headless**, which is why it fits: it computes the row model and emits
no DOM, so the markup stays a real `<table>` with `<th scope="row">` at every width.
`manualPagination: true` with no pagination row model — paging is server-side, and letting
it also page the ten rows it was handed would paginate a single page.

**One `<table>`, two layouts.** Below 768px each row becomes a card via CSS alone, driven
by a `data-label` attribute. The `<thead>` is visually hidden rather than `display: none`,
so screen readers keep the column names.

**Offline needs two signals.** `navigator.onLine === false` is a reliable negative;
`=== true` is an unreliable positive. So a rejected `fetch` is also treated as offline —
that is what catches a captive portal or an unreachable server.

**The offline illustration is a local inlined SVG.** A remote image cannot load in the one
state the modal exists for; it would render as a broken-image icon exactly when needed.

**No database.** 87 immutable read-only records and one user, never redeployed. A database
would mean a schema, a client, a connection lifecycle and a seed script to serve
`LIMIT 10 OFFSET n` from a fixed table.

---

## Known limitations

- **No password reset, and no way to delete an account.** Registration and login are
  real — credentials are verified against a salted bcrypt hash, and unknown-username and
  wrong-password responses are identical in both body *and* timing so neither reveals
  which usernames exist — but the rest of account management is out of scope.
- **The user store is a JSON file.** Registration appends to it and persists via a
  write-then-rename, so a crash mid-write cannot truncate it. There is no locking, so
  genuinely concurrent registrations could interleave; fine for one process, not a
  pattern to carry into production.
- **Sessions live in memory** and vanish when the server restarts. Correct for a demo,
  deliberately not persistent.
- **The data source is switchable.** It defaults to the Star Wars API, because requirement
  6 names that URL. Point `VITE_API_BASE_URL` at `http://localhost:3001/api` to use the
  bundled snapshot instead — the server mirrors SWAPI's response shape exactly, so it is a
  one-line switch with no code change. In SWAPI mode the data request carries no bearer
  token, since sending one to a third party would leak it.
- **The cache key does not encode the data source**, so switching between them would serve
  entries written by the other. Harmless — both return byte-identical shapes — but real.
- **A cold load of an out-of-range page** (`?page=99` typed directly) shows a 404 state
  with a "Go to the first page" action rather than clamping, because clamping needs a page
  count that does not exist until a response arrives. In-app navigation cannot reach one.
- **Lighthouse was not run.** The individual accessibility checks it audits were done by
  hand — landmarks, heading order, labels, contrast (lowest measured ratio 7.21:1), table
  semantics, focus-visible rings, reduced-motion coverage — but no score is claimed.
- **Deployment.** `BrowserRouter` needs the host to rewrite unknown paths to
  `index.html`. `vite preview` and the dev server already do; a static host needs one
  rewrite rule.

## What I'd do next

- **TanStack Query** for request dedup, background refetch and stale-while-revalidate,
  replacing the hand-rolled `usePeople` state machine.
- **Stale-while-revalidate caching** instead of discard-on-expiry: serve the stale copy
  instantly, refresh behind it. Needs a second "revalidating" state and a race guard.
- **Column sorting** — `getSortedRowModel()` is one line, but it needs a data source that
  can sort all 87 records; sorting only the visible ten would be worse than useless.
- **A light theme.** Colours are already CSS custom properties, so it is a
  `prefers-color-scheme` block re-declaring about ten values.
- **More component tests.** The pure logic (`validation`, `cache`, `format`, `pageSlots`,
  `passwords`) is well covered; `usePeople`'s abort behaviour is verified manually and
  deserves a test.
