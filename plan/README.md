# FIB — Front-end Dev Task · Plan Index

Responsive React + TypeScript app: login form with validation → protected `/table` page
rendering Star Wars API data with pagination, loading state, localStorage caching,
error handling, and an offline modal.

Verbatim task text: [task-spec.txt](task-spec.txt)
Decision & change log: **[AUDIT.md](AUDIT.md)** · Auth design: **[auth.md](auth.md)**
**Coding rules: [../AGENT.md](../AGENT.md)** — authoritative. Where this plan disagreed
with it, the plan has been corrected (component tree in [FE/00-architecture.md](FE/00-architecture.md),
SCSS namespaces, identifier names in every snippet).

---

## What the task actually asks for

| # | Requirement | Where it's planned |
|---|---|---|
| 1 | Responsive login form, username + password | [FE/03-login-form.md](FE/03-login-form.md) |
| 2 | Validation: non-empty, 4–30 chars each | [FE/03-login-form.md](FE/03-login-form.md) |
| 3 | Login button disabled while invalid | [FE/03-login-form.md](FE/03-login-form.md) |
| 4 | `react-router-dom` navigation → `/table` | [FE/02-routing-auth.md](FE/02-routing-auth.md) |
| 5 | `/table` page with a table | [FE/04-table-page.md](FE/04-table-page.md) |
| 6 | Fetch `https://swapi.py4e.com/api/people` | [FE/04-table-page.md](FE/04-table-page.md) |
| 7 | Columns: name, mass, height, hair color, skin color | [FE/04-table-page.md](FE/04-table-page.md) |
| 8 | Basic pagination | [FE/04-table-page.md](FE/04-table-page.md) |
| 9 | Visually appealing + responsive table | [FE/07-styling.md](FE/07-styling.md) |
| 10 | Loading state | [FE/04-table-page.md](FE/04-table-page.md) |
| 11 | localStorage cache **+ cache validation logic** | [FE/05-caching.md](FE/05-caching.md) |
| 12 | Error handling for failed requests | [FE/06-offline-and-errors.md](FE/06-offline-and-errors.md) |
| 13 | Offline modal **with an image inside**, testable via DevTools | [FE/06-offline-and-errors.md](FE/06-offline-and-errors.md) |

Graded on: Functionality · Responsiveness · Code Quality (hooks used appropriately) ·
Features · delivered as a GitHub repo. Mapping to each criterion: [FE/10-delivery.md](FE/10-delivery.md).

---

## Stack decisions (first pass — deliberately lean)

| Concern | Choice | Why |
|---|---|---|
| Bundler | **Vite 8** + `@vitejs/plugin-react` | CRA is deprecated; instant HMR, first-class TS + SCSS |
| UI | **React 19** | As requested |
| Language | **TypeScript 6**, `strict: true` | Graded on code quality |
| Router | **react-router-dom 7.x** | Task names it explicitly; declarative `<Routes>` mode only |
| Backend | **Express 5 + in-memory JSON** | As requested; no DB — see [BE/README.md](BE/README.md) |
| Styling | **SCSS + CSS Modules** (`*.module.scss`) | Requested; scoped class names, no global DOM mess |
| State | `useState` / `useReducer` + **one** `AuthContext` | Requested: Context only, no Redux/RTK |
| Validation | **Joi 17** | Requested; one schema library for form, cache and API query |
| Data table | **TanStack Table v8** | Requested; headless, so our markup and SCSS survive |
| Data fetching | Hand-rolled `useReducer` status machine in `usePeople` | See below |
| Tests | Vitest + RTL, **only** for `validation.ts` + `cache.ts` | Cheap credibility, no time sink |

Full stack rationale, versions and the React 19 notes: **[tech-stack.md](tech-stack.md)**.

### No Redux / RTK / Zustand / TanStack Query — and why

There are exactly **two** pieces of cross-component state:

1. `isAuthenticated` — one boolean, read by the route guard and written by the login form.
2. The people list for the current page — owned by `TablePage` alone, consumed by its own children.

(2) never leaves one subtree, so it stays in a hook. (1) is a single boolean read by two
places, so it's a ~30-line Context. A store would add a dependency, a provider, slices,
and a serialization boundary to manage one boolean. **If** this later grows real
requirements — cross-page caching of many resources, request dedup, background
refetch, optimistic writes — TanStack Query is the first thing to reach for, not Redux.
That's noted as a "what I'd add next" line in the README rather than built now.

---

## Build order (phases)

| Phase | Deliverable | Doc | Est. |
|---|---|---|---|
| 0 ✅ | Workspaces root + `client` scaffold, aliases, style tokens, **ESLint rules from AGENT.md §7**, lint/build green | [phase-0-outcome.md](phase-0-outcome.md) · [01-setup.md](FE/01-setup.md) · [07-styling.md](FE/07-styling.md) | done |
| 1 ✅ | **`server`: snapshot script, in-memory store, `/api/people`, `/api/health`** | [phase-1-outcome.md](phase-1-outcome.md) · [BE/README.md](BE/README.md) | done |
| 1b ✅ | **Server auth: `jose`, session store, login/refresh/logout/me, `requireAuth`, `.env`** | [phase-2-outcome.md](phase-2-outcome.md) · [auth.md](auth.md) | done |
| 2 ✅ | Routes + `AuthContext` (async bootstrap) + guards with a waiting state | [phase-2-outcome.md](phase-2-outcome.md) · [02-routing-auth.md](FE/02-routing-auth.md) | done |
| 3 | `Input` / `Button` primitives + `LoginForm` + **Joi** schema + async submit + tests | [03-login-form.md](FE/03-login-form.md) | 1.75 h |
| 4 | `swapi` service + `http` (attach/refresh-once/retry-once) + `usePeople` + **TanStack** `PeopleTable` + `Pagination` | [04-table-page.md](FE/04-table-page.md) · [auth.md](auth.md) | 2.75 h |
| 5 | `cache.ts` envelope + TTL/version validation + Joi payload check + tests | [05-caching.md](FE/05-caching.md) | 1.0 h |
| 6 | `ErrorState` + retry + `useOnlineStatus` + `OfflineModal` | [06-offline-and-errors.md](FE/06-offline-and-errors.md) | 1.25 h |
| 7 | Responsive polish, a11y pass, mobile card-table, focus states | [07-styling.md](FE/07-styling.md) · [09-testing-qa.md](FE/09-testing-qa.md) | 1.5 h |
| 8 | README, screenshots, manual QA matrix, repo push | [10-delivery.md](FE/10-delivery.md) | 1.0 h |

≈ **15 h** of focused work — still inside the two-day window, but the slack is largely
gone. The backend, Joi, TanStack and now JWT/sessions each add setup a hand-rolled
version wouldn't; the estimates above absorb it. Auth alone is ~+3 h across four phases
(breakdown in [auth.md](auth.md)).

---

## Assumptions I'm making (all documented in the repo README too)

1. **The token lifecycle is real; the credential check is not.** JWT, server-side
   sessions, rotation and silent refresh all work as designed — but there is no user
   store, because the task supplies no credentials. So any username/password pair passing
   the 4–30 character rules is accepted. Stated plainly here, in [auth.md](auth.md), and
   in the repo README: the worst outcome would be a reviewer thinking this was mistaken
   for real credential verification.
2. **Password length is validated raw, username is trimmed** before the length check.
   Leading/trailing spaces are legitimate password characters; in a username they're a typo.
3. **Pagination is server-side.** SWAPI already pages at 10 items/page (`count: 87` → 9 pages),
   so the client mirrors the API's paging instead of downloading all 87 and paging locally.
   Cheaper first paint, and each page gets its own cache entry.
4. **Column values are strings, including `"unknown"` and `"n/a"`.** `mass` also arrives
   comma-formatted (`"1,358"`). These are formatted for display, never coerced to `number`.
5. **`https` and a trailing slash** on the SWAPI path (`/api/people/?page=N`) — the
   no-slash form 301-redirects, which costs a round trip per request.

## Open questions (won't block the build)

- Should an invalid/expired cache entry be served as stale-while-revalidate, or discarded?
  → Planned as **discard** (simpler, matches "cache validation logic" literally); noted in
  [05-caching.md](FE/05-caching.md) as a one-line switch if the reviewer would prefer SWR.
- Offline modal: dismissible or blocking until reconnect? → Planned **dismissible**, with
  auto-close on `online`. Rationale in [06-offline-and-errors.md](FE/06-offline-and-errors.md).

## Backend

A deliberately tiny Express 5 API that loads `server/data/people.json` into memory at boot
and serves it paginated, mirroring SWAPI's exact response shape. No database, no ORM, no
persistence, no auth endpoint. Full plan and rationale: [BE/README.md](BE/README.md).

Because it mirrors SWAPI's wire shape, the FE's data source is a **one-line env switch**
(`VITE_API_BASE_URL`) with a single mapper and no branching. One decision there is worth
your eye — requirement 6 names the SWAPI URL literally, so the submitted build defaults to
SWAPI and the local backend is the dev/offline-demo source. Details in
[tech-stack.md](tech-stack.md#one-decision-that-needs-your-call).
