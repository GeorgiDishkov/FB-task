# FE 00 · Architecture & conventions

> Structure here follows [../../AGENT.md](../../AGENT.md) §4–5: one folder per component,
> sub-components in `elements/`. AGENT.md is the authority; this doc applies it.

## Layering

```
pages/          route-level views. Compose their own elements/. No fetch calls inline.
  pages/X/elements/    components owned by view X and used nowhere else
components/     components shared by two or more views
  components/ui/       generic primitives (Button, Input, Modal, Spinner) — zero domain knowledge
hooks/          reusable behaviour (usePeople, useOnlineStatus, useAuth)
context/        the single AuthContext provider
services/       network boundary — the only place that knows SWAPI URLs & response shapes
lib/            pure, framework-free helpers (Joi schemas, cache, format, errors) — 100% unit-testable
types/          shared/global types
styles/         SCSS tokens, mixins, breakpoints, global reset
```

**Dependency rule (one direction only):**
`pages → components → ui` and `pages/components/hooks → services → lib`.
`lib/` imports nothing from the app. `services/` imports no React.
That's what makes `validation.ts` and `cache.ts` testable without a DOM.

**Element rule:** an element is private to its parent and imported relatively
(`./elements/PeopleTable`). Never import from another view's `elements/` — if you want
to, the promotion rule (AGENT.md §5) has fired and it belongs in `src/components/`.

## Full target tree

The repo is an npm-workspaces root (`client/`, `server/`, `shared/` — see
[../tech-stack.md](../tech-stack.md)). This tree is the **`client/`** workspace.

```
client/
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ vite-env.d.ts
│  │
│  ├─ routes/
│  │  ├─ AppRoutes.tsx
│  │  ├─ paths.ts                 ROUTES = { login: '/', table: '/table' } as const
│  │  ├─ ProtectedRoute/          ProtectedRoute.tsx  types.ts  index.ts
│  │  └─ GuestOnlyRoute/          GuestOnlyRoute.tsx  types.ts  index.ts
│  │
│  ├─ pages/
│  │  ├─ LoginPage/
│  │  │  ├─ LoginPage.tsx
│  │  │  ├─ LoginPage.module.scss
│  │  │  ├─ index.ts
│  │  │  └─ elements/
│  │  │     └─ LoginForm/
│  │  │        ├─ LoginForm.tsx
│  │  │        ├─ LoginForm.module.scss
│  │  │        ├─ types.ts
│  │  │        ├─ index.ts
│  │  │        └─ elements/
│  │  │           └─ FormHint/    FormHint.tsx  FormHint.module.scss  types.ts  index.ts
│  │  │
│  │  ├─ TablePage/
│  │  │  ├─ TablePage.tsx
│  │  │  ├─ TablePage.module.scss
│  │  │  ├─ index.ts
│  │  │  └─ elements/
│  │  │     ├─ TableHeader/       TableHeader.tsx  …module.scss  types.ts  index.ts
│  │  │     │  └─ elements/
│  │  │     │     └─ CacheBadge/  CacheBadge.tsx  …module.scss  types.ts  index.ts
│  │  │     ├─ PeopleTable/
│  │  │     │  ├─ PeopleTable.tsx
│  │  │     │  ├─ PeopleTable.module.scss
│  │  │     │  ├─ columns.tsx            TanStack column defs + meta.label
│  │  │     │  ├─ types.ts
│  │  │     │  ├─ index.ts
│  │  │     │  └─ elements/
│  │  │     │     ├─ PersonRow/       PersonRow.tsx  …module.scss  types.ts  index.ts
│  │  │     │     ├─ ColorSwatch/     ColorSwatch.tsx  …module.scss  types.ts  index.ts
│  │  │     │     └─ TableSkeleton/   TableSkeleton.tsx  …module.scss  index.ts
│  │  │     ├─ Pagination/
│  │  │     │  ├─ Pagination.tsx
│  │  │     │  ├─ Pagination.module.scss
│  │  │     │  ├─ types.ts
│  │  │     │  ├─ index.ts
│  │  │     │  └─ elements/
│  │  │     │     ├─ PageButton/      PageButton.tsx  …module.scss  types.ts  index.ts
│  │  │     │     └─ PageSummary/     PageSummary.tsx  …module.scss  types.ts  index.ts
│  │  │     └─ ErrorState/        ErrorState.tsx  …module.scss  types.ts  index.ts
│  │  │
│  │  └─ NotFoundPage/            NotFoundPage.tsx  …module.scss  index.ts
│  │
│  ├─ components/                 shared across views only
│  │  ├─ ui/
│  │  │  ├─ Button/       Button.tsx   Button.module.scss   types.ts  index.ts
│  │  │  ├─ Input/        Input.tsx    Input.module.scss    types.ts  index.ts
│  │  │  ├─ Modal/        Modal.tsx    Modal.module.scss    types.ts  index.ts
│  │  │  ├─ Spinner/      Spinner.tsx  Spinner.module.scss  types.ts  index.ts
│  │  │  └─ Skeleton/     Skeleton.tsx Skeleton.module.scss types.ts  index.ts
│  │  ├─ OfflineModal/            mounted app-level, so not a view element
│  │  │  ├─ OfflineModal.tsx
│  │  │  ├─ OfflineModal.module.scss
│  │  │  ├─ types.ts
│  │  │  └─ index.ts
│  │  └─ ErrorBoundary/   ErrorBoundary.tsx  ErrorBoundary.module.scss  types.ts  index.ts
│  │
│  ├─ context/
│  │  └─ AuthContext/     AuthContext.tsx  AuthProvider.tsx  types.ts  index.ts
│  │
│  ├─ hooks/
│  │  ├─ usePeople.ts
│  │  ├─ useOnlineStatus.ts
│  │  ├─ useAuth.ts
│  │  └─ useLockBodyScroll.ts
│  │
│  ├─ services/
│  │  ├─ http.ts               fetch wrapper: timeout, abort, typed errors
│  │  ├─ swapi.ts              getPeoplePage(page) — cache-aware
│  │  ├─ constants.ts          base URL, timeout, page size
│  │  └─ types.ts              raw API DTOs (snake_case, all strings)
│  │
│  ├─ lib/
│  │  ├─ validation.ts         Joi loginSchema + validateLoginForm  (+ .test.ts)
│  │  ├─ schemas.ts            Joi peoplePageSchema + isPeoplePage predicate
│  │  ├─ cache.ts              + cache.test.ts
│  │  ├─ storage.ts            safeGetItem / safeSetItem / safeRemoveItem
│  │  ├─ format.ts             display formatting for "unknown" / "n/a" / "1,358"
│  │  └─ errors.ts             AppError + toAppError + isOfflineError
│  │
│  ├─ types/
│  │  ├─ api.ts                domain models used by the UI (camelCase)
│  │  ├─ common.ts             AsyncStatus, Nullable, WithClassName…
│  │  └─ index.ts              barrel
│  │
│  ├─ styles/
│  │  ├─ _tokens.scss          colors, spacing, radii, shadows, z-scale, type scale
│  │  ├─ _breakpoints.scss     $breakpoints map + respond-to() mixin
│  │  ├─ _mixins.scss          focus-ring, visually-hidden, truncate, card, tap-target
│  │  └─ global.scss           reset, base element styles, CSS custom props
│  │
│  └─ assets/
│     └─ offline.svg           the image required inside the offline modal
├─ .editorconfig
├─ eslint.config.js
├─ .prettierrc
├─ index.html
├─ package.json
├─ tsconfig.json / tsconfig.node.json
├─ vite.config.ts
└─ README.md
```

### Where things start, and why

| Component | Home | Reason |
|---|---|---|
| `Button` `Input` `Modal` `Spinner` `Skeleton` | `components/ui/` | both views use them; no domain knowledge |
| `OfflineModal` | `components/` | mounted app-level, not owned by a view |
| `ErrorBoundary` | `components/` | wraps `AppRoutes` |
| `LoginForm` | `pages/LoginPage/elements/` | only `LoginPage` uses it |
| `PeopleTable` `Pagination` `TableHeader` `ErrorState` | `pages/TablePage/elements/` | only `TablePage` uses them |
| `PersonRow` `TableSkeleton` `ColorSwatch` | `…/PeopleTable/elements/` | only `PeopleTable` uses them |
| `PageButton` `PageSummary` | `…/Pagination/elements/` | only `Pagination` uses them |

`ErrorState` is a judgement call: it's currently table-only, so it starts as a
`TablePage` element. If the login page ever needs it, it moves up — that's the promotion
rule working as intended, not a mistake to pre-empt (AGENT.md §2: no abstraction before
the second use).

## Component folder contract (AGENT.md §4)

| File | Present when |
|---|---|
| `Name.tsx` | always — named export, no default |
| `Name.module.scss` | always |
| `types.ts` | it has props or local unions |
| `index.ts` | always — `export * from './Name'; export type * from './types';` |
| `elements/` | it has sub-components |
| `Name.test.tsx` | only where it earns its keep |

Shared components are imported by alias (`@components/ui/Button`); elements are imported
relatively (`./elements/PeopleTable`). The import style tells you the ownership.

## Naming

- Components & types: `PascalCase`. Hooks: `useCamelCase`. Everything else: `camelCase`.
- SCSS module classes: `camelCase` (so `styles.tableWrapper`, not `styles['table-wrapper']`).
- Booleans read as predicates: `isLoading`, `hasError`, `canSubmit`.
- Constants: `SCREAMING_SNAKE`, in `constants.ts` next to their owner or in `lib/`.
- **Whole words, never single characters** — including SCSS `@use` namespaces
  (`as tokens`, not `as t`). Full rule and exception list in AGENT.md §1.

## Hooks discipline (a graded criterion — "Are React Hooks used appropriately")

- `useState` for independent values; `useReducer` the moment two values must change
  together (async status + data + error is exactly that — see `usePeople`).
- `useEffect` **only** for synchronising with something outside React: fetch, event
  listeners, `document.body` class. Never to derive state from props — derive inline.
- Every `useEffect` that starts async work aborts it in cleanup (`AbortController`), so a
  fast page switch can't write into an unmounted component.
- `useCallback` / `useMemo` only where there's a real referential-stability need (a hook
  dependency, or a memoized child) — not sprinkled by default (AGENT.md §2).
- Custom hooks return a **stable, narrow object** (`{ data, status, error, retry }`), not
  a bag of setters.
- Render branches are early returns, not nested JSX ternaries (AGENT.md §3).
- No `any`. No `as` casts across the network boundary — the service maps DTO → model.
