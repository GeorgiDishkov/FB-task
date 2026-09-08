# Audit · decision and change log

A running record of what was asked, what was decided, what was reversed, and what was
verified — in order. Kept so any decision in this repo can be traced back to the reason
and the moment it was made.

Companion docs: [README.md](README.md) (plan index) · [tech-stack.md](tech-stack.md) ·
[../AGENT.md](../AGENT.md) (coding rules) · `phase-N-outcome.md` (build evidence).

---

## 1 · Task intake

**Asked:** read the task PDF, work out what is actually needed, skip heavy state
libraries on the first pass, plan every part, create a `plan/` folder with FE and BE
sections. React 18 + TypeScript, a separate types folder *and* types inside every
component, SCSS with modules.

**Obstacle.** The PDF was not machine-readable by the normal path: subset-embedded fonts
with glyph-ID text encoding and `bg-BG` language tags. `pdftoppm` was unavailable and
Python was not installed.

**Resolution.** Wrote a Node extractor that inflates the PDF streams, expands object
streams, parses each font's `ToUnicode` CMap (`beginbfchar` / `beginbfrange`), and maps
glyph IDs back to text. Output saved verbatim to [task-spec.txt](task-spec.txt) so every
later claim about the requirements is checkable against the source.

**Requirements recovered:** 13, listed in [README.md](README.md). Graded on
Functionality · Responsiveness · Code Quality (React hooks used appropriately) ·
Features · delivered as a GitHub repo within two days.

**API probed before planning** (`swapi.py4e.com/api/people/?page=1`):

| Fact | Consequence |
|---|---|
| 87 records, 10 per page → 9 pages | server-side pagination, mirroring the API |
| Every field is a string (`height: "172"`) | never coerce to `number` |
| Sentinels `"unknown"`, `"n/a"`, `"none"` exist | render as `—`, keep the raw value in `title` |
| `mass` can be comma-grouped (`"1,358"`) | `Number(mass)` is `NaN`; format, don't parse |
| No `id` field; `name` is not unique | derive the row id from `url` |
| The unslashed path 301-redirects | always request `/api/people/?page=N` |

**Deliverable:** `plan/` with an index, `FE/00`–`FE/10`, and `BE/README.md`.

---

## 2 · Coding rules

**Asked:** an `AGENT.md` with binding rules — whole words rather than single characters
in conditions and loops; no over-engineered functions; sub-components in an `/elements`
folder per view; no inner loops or conditions; every component in its own folder holding
`example.tsx`, `example.module.css`, and its own `/elements`.

**Written:** [../AGENT.md](../AGENT.md), §1–§8, each rule with before/after examples drawn
from this project rather than generic ones, plus §7 — the ESLint config that enforces the
mechanical half.

**Three conflicts with the existing plan, resolved:**

| Conflict | Resolution |
|---|---|
| `.module.css` requested here, SCSS modules requested earlier | **`.module.scss`** — the earlier instruction wins on format; the folder rule stands. Flagged explicitly. |
| Flat `components/` in the plan vs. `elements/` per view | Restructured [FE/00-architecture.md](FE/00-architecture.md) entirely. Added a **promotion rule**: an element moves to `src/components/` the moment a second view needs it, and no view may import another view's `elements/`. |
| The plan's own snippets were full of single-char identifiers | Swept all 12 docs: `as t`→`as tokens`, `r()`→`resolvePath()`, `<T>`→`<Payload>`/`<Item>`/`<Value>`, `(e)`→`(event)`, `(err)`→`(error)`, `$bp`→`$breakpoint`, `(k)`→`(currentKey)`. |

**Interpretations recorded:** §1 extended beyond single characters to non-word
abbreviations (`err`→`error`, `i`→`index`, `res`→`response`) because that is the same
habit; §3 fixed maximum nesting depth at **1**, and clarified that *sequential* `if`
guards are not nesting — otherwise the cache's five validation checks would read as a
violation; §2 given an explicit boundary so "simple" cannot be used to justify skipping
error handling, cleanup, or a11y wiring.

---

## 3 · Stack direction

**Asked:** a tech-stack document. JS, **React 19** (not 18), TypeScript. React Context
for state, no Redux/RTK. A very small backend using JSON files held in memory — no
database, nothing redeployed, don't overkill it.

**Two reversals of earlier decisions:**

| Was | Now | Note |
|---|---|---|
| React 18.3.1 | **React 19** | Simplified the plan: `forwardRef` gone (`ref` is a normal prop), `<Context value>` renders as its own provider, ref callbacks may return cleanups |
| "No backend needed" | **A backend exists** | The first-pass BE doc had concluded none was justified; superseded, with the original reasoning kept in a decision record rather than deleted |

**Decisions taken:**

- **The backend mirrors SWAPI's exact wire shape** (`count`/`next`/`previous`/`results`,
  snake_case) rather than serving the client's camelCase model. This is what makes the
  data source a one-line env switch with a single client mapper and no branching.
- **Fixed page size of 10, no `pageSize` parameter** — SWAPI has none, and identical
  behaviour from both sources beats a knob with no caller.
- **No login endpoint.** ⚠️ *Reversed in §7.*
- **npm workspaces** with a `shared/` contract package.
- Confirmed **no Redux/RTK/Zustand/react-query**: exactly one piece of global state.

**Flagged for the user:** requirement 6 names the SWAPI URL literally, so pointing the
client only at our own backend risks a reviewer marking it unmet. Recommended an
env-switchable base URL with SWAPI as the default. **User confirmed: keep SWAPI default.**

---

## 4 · Validation and table libraries

**Asked:** add Joi for validation and TanStack for the table.

**Applied across:** [tech-stack.md](tech-stack.md), [FE/03-login-form.md](FE/03-login-form.md),
[FE/04-table-page.md](FE/04-table-page.md), [FE/05-caching.md](FE/05-caching.md),
[FE/08-types.md](FE/08-types.md), [FE/09-testing-qa.md](FE/09-testing-qa.md),
[FE/10-delivery.md](FE/10-delivery.md), [BE/README.md](BE/README.md).

**Costs stated rather than hidden.** Joi is ~40 KB gzipped to validate two form fields
that ~30 hand-written lines would cover; TanStack Table is more machinery than
`people.map()` for 5 fixed columns. Both brush against AGENT.md §2. What they buy: one
schema definition instead of the same rules implemented twice, and column definitions
type-checked against `Person` with sorting a one-liner later. Recorded in the docs and
destined for the repo README, so the choice reads as considered rather than accidental.

**Two Joi configuration traps documented up front**, because neither is visible in normal
use: `abortEarly: false` on the form (Joi's default reports only the first bad field, so
a user would fix errors one at a time), and `convert: false` on the cache read (a cached
`totalCount: "87"` would otherwise coerce and reach the UI as a string). Both have
regression tests planned.

**TanStack specifics fixed in the plan:** `manualPagination: true` with no
`getPaginationRowModel()` (paging is server-side; letting TanStack also page 10 rows
would paginate a single page), `meta.label` feeding `data-label` for the CSS-only mobile
card layout, and the name cell staying `<th scope="row">`.

---

## 5 · Phase 0 — scaffold

**Asked:** keep SWAPI as the default, start Phase 0.

Full record: [phase-0-outcome.md](phase-0-outcome.md).

**The template shipped newer tooling than planned:** Vite **8** (not 7), TypeScript
**~6.0** (not 5.x), Vitest 5, and **oxlint** instead of ESLint.

**Decisions:**

| Decision | Reason |
|---|---|
| **ESLint 9, not 10** | `eslint-plugin-jsx-a11y` caps at `eslint ^9`; forcing the peer risked rules crashing on APIs ESLint 10 removed. Automated a11y rules valued above a clean install log. |
| **Removed oxlint** | AGENT.md §7 is written in ESLint vocabulary, incl. an AST-selector `no-restricted-syntax`. Guessing at oxlint's coverage risked silently unenforced rules. |
| **`shared/` is types-only, zero deps** | The two Joi schemas planned for it have no shared consumer — login is client-only, the page query server-only. Types erase entirely, so no build step. |
| **SCSS via `loadPaths`** | A bare `@use 'tokens' as tokens;` at any depth, with no dependence on Vite's alias reaching the Sass importer. |
| **Dropped the `@types/*` alias** | Collides conceptually with the DefinitelyTyped scope; shared types reached as `@/types` instead. One less alias. |
| **No `baseUrl`** | TS 6 raises `TS5083`. Removed rather than silenced — `paths` resolve relative to the tsconfig. |

**Risk found and mitigated.** A cold `npm install` with no lockfile fails on npm 10.9.2:
arborist throws `TypeError: Cannot read properties of null (reading 'edgesOut')` walking
Vitest's large optional-peer set. `npm ci` from the committed lockfile works, and so does
`npm install` with the lockfile present. Mitigation: commit `package-lock.json`, tell
contributors to use `npm ci`. Matters because "fresh clone actually starts" is a
pre-submission check.

**Verified rather than assumed** — tokens reach the DOM (`body` background is `--c-bg`),
`respond-to('sm')` fires (32px vs 24px padding), `visually-hidden` measures 1px while
staying in the a11y tree, class names are traceable (`App-module__card___HPkww`), and
**every AGENT.md §7 rule fires** against a deliberate-violation probe. A lint config that
silently enforces nothing is worse than none.

---

## 6 · Git and Phase 1 — backend

**Asked:** git init first, then follow the plan.

Full record: [phase-1-outcome.md](phase-1-outcome.md).

**Repository:** `git init -b main`. Four commits, structured so the reasoning is
reviewable separately from the code (docs → phase-0 → phase-1 → outcomes). Added
`.gitattributes` with `eol=lf` because `core.autocrlf` is on globally and would have
fought `.editorconfig`. `.claude/settings.local.json` ignored; `launch.json` kept.
**No remote; nothing pushed.**

**Built:** Express 5 reading a committed 61 KB / 87-record snapshot into a frozen array
at module init. `GET /api/people?page=N` and `GET /api/health`. Three runtime
dependencies.

**Shape parity verified against live SWAPI**, since the whole env-switch design rests on
it: top-level keys, all 16 record keys, `count`, record ordering and the five display
fields all match. Only `next`/`previous` differ, pointing at our host by design. `url` is
preserved verbatim — so the client-derived row `id` is identical from either source. Had
the server rewritten it, cache keys and React row keys would have silently diverged
between modes.

**Two problems the type checker caught:**

1. **Joi's `ValidationResult` is a discriminated union** —
   `{ error: undefined; value: TSchema } | { error: ValidationError; value: any }`. The
   plan's snippet destructured `{ value, error }` up front, which unions `value` down to
   `any` and makes the typed schema worthless. Must narrow on `error` first. Applies
   equally to the login form.
2. **`shared/` must satisfy the strictest consumer.** `export type * from './types'`
   resolved for the client (`bundler`) but failed the server's `nodenext` (`TS2835`).
   Now `'./types.js'`, which both accept.

**Deviation:** no `dist/`, no `start` script — `noEmit: true`, `build` is a type-check.
The plan already said `dist/` existed only for CI; making it explicit removed a
`rootDir`/`outDir` problem.

**Verified:** all 13 endpoint cases (page 9 returns the trailing 7 with `next: null`;
out-of-range gives 200 + empty results + the real count; `abc`/`0`/`-3`/`1.5` all 400 —
`.integer()` is what catches `1.5`; unknown paths 404 in the same envelope; CORS
restricted to the Vite origin, not `*`), plus boot failure on a missing **and** an empty
snapshot, tested by actually moving the file.

---

## 7 · Authentication — JWT, sessions, token refresh

**Asked:** add JWT and sessions to the stack, with the secret collected from `.env` for
this example, and a refresh mechanism for the token.

**This reverses a decision I recommended in §3.** I had argued against a login endpoint
on the grounds that the task supplies no credentials, so there is nothing to authenticate
against. That objection was raised, and the instruction stands — so auth is now in scope
and built in full. Design: [auth.md](auth.md).

The objection does not disappear, it just moves: there is still **no user store**, so any
valid-format username/password pair is accepted. What JWT and sessions add is a real
token lifecycle — issue, verify, expire, refresh, rotate, revoke — which is the part the
task's login flow was previously faking with a `sessionStorage` boolean.

**Decisions:**

| Decision | Reason |
|---|---|
| **`jose`** for JWT, not `jsonwebtoken` | ESM-native, zero-dependency, typed; the server is `"type": "module"` |
| **Access token: JWT, short-lived, held in memory** | Not in `localStorage` — an XSS there reads a usable credential |
| **Refresh token: opaque random, `httpOnly` cookie** | Opaque so it can be revoked server-side; a JWT refresh token cannot be. `httpOnly` keeps it out of JS reach |
| **Session store: in-memory `Map`, refresh tokens stored hashed** | Matches the "everything in memory" constraint; hashing means the store never holds a usable secret |
| **Refresh rotation with reuse detection** | A replayed old token revokes the whole session — the standard pattern, ~10 lines |
| **`JWT_SECRET` from `.env`, server refuses to boot without it** | As asked. Fails loudly rather than defaulting to a hardcoded secret |
| **Single in-flight refresh promise on the client** | Three parallel 401s would otherwise trigger three refreshes, and rotation invalidates each other — a real bug, not a hypothetical |

**Consequence of keeping SWAPI as the default data source:** authentication always runs
against our own backend, but in SWAPI mode the *data* request goes to a public API and
carries no token. So the token gates our `/api/people`, which is only exercised in
backend mode. That is an honest consequence of requirement 6 naming the SWAPI URL, not an
oversight — noted here because it is the kind of thing a reviewer will ask about.

**This supersedes the `sessionStorage` session flag** in
[FE/02-routing-auth.md](FE/02-routing-auth.md), and makes Phase 2 materially larger:
`AuthContext` gains an async bootstrap state, and `ProtectedRoute` must render a waiting
state rather than redirecting while that is in flight — redirecting during bootstrap
would bounce a logged-in user to the login page on every page refresh.

---

## Reversals register

Every decision that was later overturned, so no doc reads as if it were always the plan:

| # | Original | Superseded by | Trigger |
|---|---|---|---|
| 1 | React 18.3.1 | React 19 | §3, user instruction |
| 2 | No backend needed | Express 5 + in-memory JSON | §3, user instruction |
| 3 | No login endpoint (auth is "theatre") | Full JWT + session + refresh | §7, user instruction |
| 4 | `sessionStorage` boolean as the fake session | Real token lifecycle | §7, consequence of 3 |
| 5 | Hand-written validators | Joi schemas | §4, user instruction |
| 6 | `people.map()` table | TanStack Table v8 | §4, user instruction |
| 7 | `shared/` holds types **and** Joi schemas | Types only, zero deps | §5, no shared consumer existed |
| 8 | Vite 7 / TS 5.x / ESLint 10 | Vite 8 / TS 6 / ESLint 9 | §5, template defaults + a peer cap |
| 9 | `@use '@styles/tokens'` in SCSS | `loadPaths` + bare `@use 'tokens'` | §5, robustness |
| 10 | `@types/*` path alias | `@/types` | §5, scope collision |
| 11 | Server emits `dist/`, has `start` | `noEmit`, type-check only | §6, nothing is deployed |

## Open items awaiting a call

| Item | Current default | Where |
|---|---|---|
| Cache expiry: discard vs. stale-while-revalidate | **discard** (matches "simple validation logic" literally) | [FE/05-caching.md](FE/05-caching.md) |
| Offline modal: dismissible vs. blocking | **dismissible**, auto-closes on reconnect | [FE/06-offline-and-errors.md](FE/06-offline-and-errors.md) |
| Data source default | **SWAPI** (user-confirmed) — so the backend's protected endpoint is only used in backend mode | [auth.md](auth.md) |
| Remote / push | none; four local commits on `main` | [FE/10-delivery.md](FE/10-delivery.md) |

## Standing risks

| Risk | Status |
|---|---|
| Cold `npm install` without a lockfile fails (npm arborist + Vitest peers) | Mitigated: lockfile committed, `npm ci` documented |
| `npm install` prints `deprecated eslint@9` | Accepted deliberately; revisit when `jsx-a11y` widens its peer range |
| SWAPI is third-party and may be slow or down on review day | Mitigated: committed snapshot + our own backend serve identical shapes |
| Joi's ~40 KB in the browser bundle | Accepted; isolated in `lib/validation.ts`, swappable |
