# AGENT.md — coding rules for this project

Binding rules for anyone (human or agent) writing code here. If a rule below conflicts
with something in [plan/](plan/), **this file wins** and the plan gets corrected.

---

## 1. Names are whole words — never single characters

Applies everywhere, but especially in conditions, loops, and callbacks, where short
names are the usual habit.

```ts
// ✅
for (const person of people) { … }
people.map((person) => person.name);
people.filter((person) => person.mass !== 'unknown');
request.catch((error) => reportNetworkFailure(error));
pages.forEach((page, index) => …);

// ❌
for (const p of people) { … }
people.map((p) => p.name);
request.catch((e) => …);
pages.forEach((pg, i) => …);
```

Same rule for abbreviations that aren't words — that's the same habit wearing a longer
coat:

| ❌ | ✅ |
|---|---|
| `e`, `ev`, `evt` | `event` |
| `err` | `error` |
| `i`, `idx` | `index` |
| `res`, `resp` | `response` |
| `req` | `request` |
| `val` | `value` |
| `btn` | `button` |
| `el`, `elem` | `element` |
| `prev` | `previous` |
| `acc` | `accumulator` |
| `cb` | `callback` / the specific name (`onPageChange`) |

**Also applies to SCSS `@use` namespaces:**

```scss
// ✅
@use '@styles/tokens' as tokens;
@use '@styles/breakpoints' as breakpoints;
@use '@styles/mixins' as mixins;

.card { padding: tokens.space(6); }

// ❌
@use '@styles/tokens' as t;
.card { padding: t.space(6); }
```

**Narrow, named exceptions** (established conventions where the long form is worse):

- `id` — it's a whole word.
- `props`, `state`, `action`, `children`, `ref` — React vocabulary.
- `_` as a deliberately-unused parameter placeholder.
- Type parameters: `<T>`, `<Element>`. Prefer a real name (`<Payload>`) when there's more
  than one.

Enforced by ESLint `id-length` (see §7). If the rule ever fires on something genuinely
reasonable, add it to the exceptions list in one commit — don't silence it inline.

---

## 2. Don't over-engineer functions

A function does one thing at the level of abstraction its name promises. It doesn't grow
options for callers that don't exist yet.

**Concrete meaning in this project:**

```ts
// ❌ over-engineered: three of the four parameters have exactly one caller
const fetchData = (url, { method = 'GET', retries = 3, transform, cache = true } = {}) => …

// ✅ two functions, each with one job
const requestJson = <Payload>(url: string, signal?: AbortSignal): Promise<Payload> => …
const getPeoplePage = (page: number, signal?: AbortSignal): Promise<PeoplePage> => …
```

Rules of thumb:

- **No parameter exists until a second caller needs it.** No `options` bags with defaults
  nobody passes. No `isEnabled` flags with one call site.
- **No generic before the second concrete use.** A `useFetch<T>(url)` that only ever
  fetches people is worse than `usePeople(page)`.
- **No abstraction layer with one implementation.** No `IStorageAdapter` interface with a
  single `LocalStorageAdapter` behind it.
- **No premature memoization.** `useMemo` / `useCallback` only where identity actually
  matters (a hook dependency, or a memoized child). Wrapping `validateLoginForm` on two
  short strings in `useMemo` costs more than it saves.
- **Prefer duplicating twice over abstracting once.** Extract on the third occurrence,
  when the shape is actually known.

**What this rule does *not* license:** skipping error handling, skipping cleanup
(`AbortController`), skipping a11y wiring, or skipping the cache validation checks. Those
are requirements, not embellishments. "Simple" means *no speculative machinery* — not
*fewer working features*.

Signals a function has drifted: more than ~4 parameters, a boolean parameter that changes
what it does, a name containing "And", or a return type that's a union of unrelated shapes.

---

## 3. No nested loops and no nested conditions

Maximum nesting depth inside a function body: **one**. If you need a second level,
extract a function or restructure.

### Conditions → guard clauses, early return

```ts
// ❌ nested
const readCache = (key) => {
  const raw = safeGetItem(key);
  if (raw !== null) {
    const parsed = parseJson(raw);
    if (parsed !== null) {
      if (parsed.version === CACHE_SCHEMA_VERSION) {
        if (!isExpired(parsed)) {
          return parsed.payload;
        }
      }
    }
  }
  return null;
};

// ✅ flat — each check is a guard that exits
const readCache = (key) => {
  const raw = safeGetItem(key);
  if (raw === null) return null;

  const parsed = parseJson(raw);
  if (parsed === null) return removeAndMiss(key);
  if (!isCacheEnvelope(parsed)) return removeAndMiss(key);
  if (parsed.version !== CACHE_SCHEMA_VERSION) return removeAndMiss(key);
  if (isExpired(parsed)) return removeAndMiss(key);

  return parsed.payload;
};
```

Sequential `if`s at depth one are **not** nesting. The cache's five validation checks are
five guards in a row — correct by this rule, and clearer than the nested version.

### Loops → extract, or use the right array method

```ts
// ❌ nested loop
for (const page of pages) {
  for (const person of page.results) {
    collected.push(mapPerson(person));
  }
}

// ✅
const collected = pages.flatMap((page) => page.results.map(mapPerson));
```

```ts
// ❌ condition inside a loop inside a function
const clearPeopleCache = () => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};

// ✅ filter, then act
const clearPeopleCache = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(CACHE_KEY_PREFIX))
    .forEach(removeCache);
};
```

### Also banned

- **Nested ternaries.** One ternary is fine; a ternary inside a ternary is not.
- **`if`/`else if` chains longer than two branches** — use a lookup object:

  ```ts
  // ✅
  const ERROR_MESSAGES: Record<AppErrorKind, string> = {
    network: 'You appear to be offline.',
    timeout: 'The request took too long.',
    http:    'The Star Wars API is having trouble.',
    parse:   'We got an unexpected response.',
    aborted: '',
    unknown: 'Something went wrong.',
  };
  ```

- **`else` after a `return`.** Return early, drop the `else`.
- **JSX nested ternaries.** Render branches get extracted into a small function or an
  early `return` in the component, one branch per line:

  ```tsx
  // ✅
  if (status === 'loading' && data === null) return <TableSkeleton />;
  if (status === 'error' && data === null) return <ErrorState error={error} onRetry={retry} />;
  return <PeopleTable people={data.people} … />;
  ```

---

## 4. Every component gets its own folder

No loose `.tsx` files next to each other. One component = one folder, always the same
slots:

```
Button/
├─ Button.tsx            the component (named export, no default export)
├─ Button.module.scss    its styles
├─ types.ts              its props and local unions
├─ index.ts              export * from './Button'; export type * from './types';
└─ elements/             sub-components split out of Button (see §5)
```

- `types.ts` and `elements/` exist **only when there's something to put in them.** An
  empty `elements/` folder or a `types.ts` re-exporting nothing is clutter (§2).
- Consumers import the folder, never the file: `import { Button } from '@components/ui/Button'`.
  Internal file moves then stay invisible to callers.
- **Styles are `.module.scss`, not `.module.css`** — we settled on SCSS with modules
  earlier, and the plan's tokens/mixins/breakpoints are Sass. Everything else about the
  rule stands.

---

## 5. Sub-components live in `elements/`

Every view (and every component) keeps the pieces it owns in its own `elements/` folder.
Each element is itself a folder following §4, recursively.

```
pages/TablePage/
├─ TablePage.tsx
├─ TablePage.module.scss
├─ index.ts
└─ elements/
   ├─ PeopleTable/
   │  ├─ PeopleTable.tsx
   │  ├─ PeopleTable.module.scss
   │  ├─ types.ts
   │  ├─ index.ts
   │  └─ elements/
   │     ├─ PersonRow/       PersonRow.tsx  PersonRow.module.scss  types.ts  index.ts
   │     └─ TableSkeleton/   TableSkeleton.tsx  …
   ├─ Pagination/
   │  ├─ Pagination.tsx
   │  ├─ Pagination.module.scss
   │  ├─ types.ts
   │  ├─ index.ts
   │  └─ elements/
   │     └─ PageButton/      PageButton.tsx  …
   ├─ TableHeader/           TableHeader.tsx  …
   └─ ErrorState/            ErrorState.tsx  …
```

**Elements are imported relatively** — `import { PeopleTable } from './elements/PeopleTable'`.
That's the marker of ownership: an element is private to its parent, and a relative
import makes a violation obvious in review.

### The promotion rule

An element belongs to exactly one parent. **The moment a second view needs it, it moves
up** — out of `elements/`, into `src/components/`, and its imports become aliased
(`@components/…`).

| Location | Meaning |
|---|---|
| `pages/X/elements/Y/` | `Y` is used only by view `X` |
| `src/components/Y/` | `Y` is used by two or more views |
| `src/components/ui/Y/` | `Y` is generic with zero domain knowledge — `Button`, `Input`, `Modal`, `Spinner` |

Known from the plan: `Button`, `Input`, `Modal`, `Spinner`, `Skeleton` start in
`components/ui/` because both views use them. `OfflineModal` starts in `src/components/`
because it's mounted app-level. Everything else starts inside its view's `elements/`.

**Never** import from another view's `elements/`. If you want to, that's the promotion
rule firing — move it.

---

## 6. Carried over from the plan (still in force)

- One-directional dependencies: `pages → components → ui`, and
  `pages/components/hooks → services → lib`. `lib/` imports nothing from the app;
  `services/` imports no React.
- No `any`. Untrusted input is `unknown`, narrowed by a type predicate.
- Named exports only — no `export default`.
- Derived values are computed in render, never mirrored into state via `useEffect`.
- `useEffect` only for syncing with something outside React, always with cleanup.
- Raw API DTOs stay in `services/types.ts`. Nothing outside `services/` sees snake_case.
- `@use` in SCSS, never `@import`.
- No `z-index` literal outside `_tokens.scss`.

---

## 7. ESLint enforcement

The rules above that a linter can check, so review time goes on the ones it can't:

```js
rules: {
  // §1 whole words
  'id-length': ['error', {
    min: 3,
    exceptions: ['id', '_'],
    properties: 'never',      // don't police API response keys
  }],

  // §3 no nesting
  'max-depth': ['error', 1],
  'max-nested-callbacks': ['error', 2],
  'no-nested-ternary': 'error',
  'no-lonely-if': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  complexity: ['warn', 8],

  // §2 no over-engineering
  'max-params': ['warn', 4],
  'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],

  // §6
  'no-restricted-syntax': ['error', {
    selector: 'ExportDefaultDeclaration',
    message: 'Named exports only.',
  }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
}
```

Run at `--max-warnings 0`, so a `warn` still fails the build — but stays distinguishable
from an error when reading output.

`id-length` with `min: 3` will fire on things like `to`, `on`, `up`. Add them to
`exceptions` as they come up, in a commit of their own, rather than with an inline
`eslint-disable`.

---

## 8. When a rule is wrong

If a rule makes code genuinely worse in a specific spot, **say so and change the rule
here** — don't add an `eslint-disable-next-line` and move on. One documented exception in
this file beats scattered silenced warnings.
