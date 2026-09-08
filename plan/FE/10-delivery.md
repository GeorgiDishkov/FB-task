# FE 10 · Delivery: repo, README, criteria mapping

> *"The front-end development task should be completed within a maximum timeframe of two
> days… Please create a GitHub repository for the project and submit the completed task
> via the provided repository link."*

## Repo

- Public GitHub repo, e.g. `fib-swapi-table` (or whatever name the assignment thread uses).
- `main` as the default branch. Real, incremental commits — one per phase from
  [../README.md](../README.md) — not a single "initial commit" dump. Commit history *is*
  part of what gets read for the Code Quality criterion.
- `.gitignore`: `node_modules`, `dist`, `.env*`, `coverage`, `.DS_Store`, editor dirs.
- `plan/` **stays in the repo.** It shows the reasoning behind the decisions and the
  documented trade-offs, which is exactly what a code-quality reviewer wants to see.
- Optional but cheap: a GitHub Actions workflow running `npm ci && npm run lint && npm run test && npm run build`
  on push. A green check on `main` answers "does it build?" before anyone clones it.

## Deployment (optional, high return)

A live URL removes all friction for the reviewer. Vercel or Netlify: connect the repo,
zero config for Vite, one SPA rewrite rule (`/* → /index.html`) so a refresh on `/table`
doesn't 404 — see the caveat in [02-routing-auth.md](02-routing-auth.md). Link it at the
top of the README.

If GitHub Pages instead: set `base` in `vite.config.ts` to `/<repo-name>/` and add a
`404.html` copy of `index.html`.

## Repo README — the outline

The README is the first thing read and effectively the cover letter. Structure:

1. **What it is** — two sentences + the live link.
2. **Screenshots** — login (desktop + mobile), table (desktop + mobile), offline modal.
   Four images. This is the single highest-return 15 minutes in the whole task; nobody
   should have to `npm install` to see whether it looks good.
3. **Run it** — `npm install`, `npm run dev`, and the other scripts.
4. **Requirements checklist** — every one of the 13 requirements with a ✅ and a link to
   the file that implements it. Makes it impossible to miss that something was done.
5. **Architecture** — the folder tree and the one-directional dependency rule, condensed
   from [00-architecture.md](00-architecture.md).
6. **Decisions & trade-offs** — the section that matters most:
   - **No Redux/RTK/Zustand/react-query** — React Context only, with the
     two-pieces-of-state argument. Framed as a deliberate, justified choice, not an omission.
   - **Why there's a backend at all**, and why it's in-memory JSON: 87 immutable read-only
     records, not being redeployed, so a database would be schema + client + connection
     lifecycle + seed script to serve `LIMIT 10 OFFSET n` from a fixed table.
   - **The backend mirrors SWAPI's wire shape**, which is what makes the data source a
     one-line env switch with a single FE mapper. Both modes documented, with the reason
     the submitted build defaults to SWAPI (requirement 6 names that URL literally).
   - **Joi for validation**, one schema library covering the login form, the cache payload,
     and the backend's query params — including the honest note that it's ~40 KB gzipped
     for two form fields, and what that buys.
   - **TanStack Table**, headless, so the semantic `<table>` and the CSS-only mobile card
     layout are untouched — plus `manualPagination: true`, since paging is server-side.
   - **The token lifecycle is real; the credential check is not.** JWT access tokens,
     `httpOnly` refresh cookies, server-side sessions, rotation with reuse detection and
     silent refresh all work — but there is no user store, so any 4–30 character pair is
     accepted. Stated plainly and up front: the worst possible outcome is a reviewer
     thinking I believed this verified credentials. Design in [../auth.md](../auth.md).
   - **Why the access token is in memory and the refresh token is an `httpOnly` cookie** —
     anything in `localStorage` is a usable bearer credential for any script on the
     origin. Includes why the refresh token is opaque rather than a JWT (revocability).
   - **`AuthStatus` is a three-state union, not a boolean** — the access token is always
     absent at mount, so a boolean guard would sign users out on every page refresh.
   - **Server-side pagination**, because SWAPI already pages at 10/page.
   - **Username trimmed, password not** — why.
   - **Cache: discard on expiry, not stale-while-revalidate** — why, and what I'd change.
   - **Offline needs both signals** (`navigator.onLine` + a rejected `fetch`), because
     `onLine === true` doesn't mean reachable.
   - **The offline image is a local SVG**, because a remote image cannot load while offline.
7. **How to test the offline modal** — the numbered DevTools steps from
   [06-offline-and-errors.md](06-offline-and-errors.md), including the cached-page-works-offline
   case. Never make a reviewer guess how to trigger a feature.
8. **How to test the cache** — the Application → Local Storage steps, including
   hand-editing `version` and `savedAt` to watch validation reject them.
9. **What I'd do next with more time** — TanStack Query for request dedup/background
   refetch, stale-while-revalidate caching, component tests with RTL, column sorting
   (`getSortedRowModel()` is one line now that TanStack Table is wired up, but it needs a
   data source that can sort all 87 records), a light theme (the tokens already allow it),
   i18n for the strings. Shows the choices were scoped rather than unconsidered.
10. **Known limitations** — SWAPI is a third-party service and occasionally slow; the
    9-page dataset is small so pagination is windowed but never needs a jump-to-page
    input; no virtualisation because 10 rows/page doesn't need it.

## Evaluation-criteria mapping

| Criterion (verbatim) | How it's met |
|---|---|
| **Functionality** — "Does the login form perform basic validation?" | `lib/validation.ts`, 4–30 chars both fields, unit-tested; disabled button bound to derived validity ([03](03-login-form.md)) |
| — "Is the redirection to the data table page working correctly?" | `react-router-dom` v6, `navigate(ROUTES.table, { replace: true })` + `ProtectedRoute` / `GuestOnlyRoute` guards ([02](02-routing-auth.md)) |
| — "Is the data table populated with information from the API?" | `services/swapi.ts` → DTO→model mapper → `PeopleTable`, exactly the 5 specified columns ([04](04-table-page.md)) |
| **Responsiveness** | Mobile-first SCSS, `min-width`-only breakpoints, one `<table>` that restyles to cards under 768px with CSS alone, verified 320→1440 ([07](07-styling.md), [09](09-testing-qa.md)) |
| **Code Quality** — "well-organized, readable, best practices" | One-directional layering; folder-per-component with a fixed 5-file contract; `strict` TS with `noUncheckedIndexedAccess`; pure `lib/` with no framework imports; zero `any`; ESLint clean at `--max-warnings 0` ([00](00-architecture.md), [08](08-types.md)) |
| — "Are React Hooks used appropriately for state management and side effects?" | `useReducer` for the coupled async triple; derived state computed in render rather than mirrored into state via `useEffect`; `useEffect` reserved for external sync (fetch, event listeners, body scroll) with `AbortController` cleanup; `useMemo` only on the context value where identity actually matters; `useId` for label wiring; custom hooks (`usePeople`, `useOnlineStatus`, `useAuth`) as the reuse unit ([00](00-architecture.md), [04](04-table-page.md)) |
| **Features** — "Are the features implemented and enhance the overall UX?" | Skeleton on cold load vs. dimmed-table on page change; versioned+TTL cache with 6 validation checks and a visible `Cached · 2m ago` badge; per-error-kind messaging (4xx vs 5xx vs offline vs timeout); offline modal with local SVG, focus trap, and auto-close on reconnect; cached pages readable while offline; request timeout so a spinner can't hang forever ([04](04-table-page.md), [05](05-caching.md), [06](06-offline-and-errors.md)) |
| **Project Completion** | ~10 h of planned work across 8 phases inside the 2-day window; public repo, phase-per-commit history, live deployment, `plan/` retained as design notes |

## Pre-submission checklist

- [ ] Every box in [09-testing-qa.md](09-testing-qa.md) ticked
- [ ] `npm ci && npm run lint && npm run test && npm run build` clean from a fresh clone
- [ ] Fresh clone in a new folder actually starts (catches a dep that only exists locally)
- [ ] Four screenshots in the README and rendering on github.com
- [ ] Live URL works, including a hard refresh on `/table`
- [ ] README states plainly that the login is not real authentication
- [ ] No `console.log`, no commented-out code, no `TODO` left in `src/`
- [ ] Repo is public / the reviewer has access; link sent in the assignment thread
