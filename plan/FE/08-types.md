# FE 08 · Type organisation

Your instruction: *"separate types on folder, also inside of the every component (this
will give us flexibility to reuse them)"*. So both — a shared `src/types/` folder **and**
a `types.ts` inside each component folder. The rule for which goes where:

> **A type lives next to its only consumer until a second consumer appears.**
> Component-owned types (props, local unions, local variants) live in the component's
> `types.ts`. Anything crossing a module boundary — domain models, API shapes, shared
> utility types — lives in `src/types/`.

That gives reuse where reuse is real, without a giant central `types.ts` that everything
imports and nothing owns.

## `src/types/` — shared only

```ts
// types/api.ts — domain models the UI consumes (camelCase, mapped from DTOs)
export interface Person {
  id: string;
  name: string;
  height: string;
  mass: string;
  hairColor: string;
  skinColor: string;
}

export interface PeoplePage {
  people: Person[];
  totalCount: number;
  totalPages: number;
  page: number;
}
```

```ts
// types/common.ts — genuinely cross-cutting utilities
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type Nullable<Value> = Value | null;

/** Every component that accepts an outer class name. */
export interface WithClassName { className?: string; }

/** Props of the underlying element, minus what we own. */
export type PropsOf<TagName extends React.ElementType> =
  React.ComponentPropsWithoutRef<TagName>;
```

```ts
// types/index.ts — barrel, so callers write one import
export type * from './api';
export type * from './common';
```

`export type *` (TS 5.0+) makes it explicit that the barrel carries no runtime value —
which matters with `verbatimModuleSyntax` and keeps the barrel out of the bundle entirely.

**Not in `src/types/`:** the raw SWAPI wire shapes. Those live in `services/types.ts`
(`SwapiPersonDto`, `SwapiPageDto<Item>`) because **nothing outside `services/` should ever
see snake_case**. Putting the DTO in the shared folder is an invitation for a component
to import `hair_color`, and then the mapper's whole purpose is gone. The boundary is
enforced by placement.

## Component-local `types.ts`

```ts
// components/ui/Button/types.ts
import type { PropsOf } from '@types';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<PropsOf<'button'>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  className?: string;
}
```

```ts
// pages/TablePage/elements/PeopleTable/types.ts
import type { Person } from '@types';

export interface PeopleTableProps {
  people: Person[];
  isRefreshing?: boolean;
  page: number;
  totalPages: number;
}
```

```ts
// pages/TablePage/elements/Pagination/types.ts
export interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  isDisabled?: boolean;
  onPageChange: (page: number) => void;
}
```

Note `Pagination` imports **nothing** — it's fully generic and could paginate any list.
That's the "flexibility to reuse" the folder-per-component structure is for: the type
travels with the component, so moving the folder moves everything it needs.

## Conventions

| Rule | Why |
|---|---|
| `interface` for object shapes, `type` for unions/aliases/mapped types | interfaces give better error messages and allow declaration merging where needed |
| Extend `ComponentPropsWithoutRef<'element'>` on every primitive | `placeholder`, `maxLength`, `onBlur`, `data-*` all pass through free; no prop re-declaration |
| `import type { … }` always for type-only imports | required by `verbatimModuleSyntax`; guarantees the import is erased |
| Props interfaces named `<Component>Props` | one grep finds it |
| **No `any`.** Unknown input is `unknown` and narrowed by a type guard | `any` at the network boundary silently voids every type below it |
| No `as` casts across the network boundary | the one exception is the single `as T` inside `requestJson`, immediately after which the mapper validates and narrows |
| Discriminated unions over optional-field bags | see below |

## The two places typing does real work

**1. The async state union** ([04-table-page.md](04-table-page.md)):

```ts
type PeopleState =
  | { status: 'idle';    data: null;              error: null }
  | { status: 'loading'; data: PeoplePage | null; error: null }
  | { status: 'success'; data: PeoplePage;        error: null }
  | { status: 'error';   data: PeoplePage | null; error: AppError };
```

vs. the naive `{ isLoading: boolean; data?: PeoplePage; error?: AppError }`, which permits
`isLoading: true, data: X, error: Y` — a state that means nothing — and forces `data?.people`
everywhere. The union makes the impossible states *unrepresentable*, and `switch (state.status)`
with `noFallthroughCasesInSwitch` gives exhaustiveness for free.

**2. Joi schemas behind type predicates** ([05-caching.md](05-caching.md)):

```ts
export const isPeoplePage = (value: unknown): value is PeoplePage =>
  peoplePageSchema.validate(value, { convert: false }).error === undefined;

const cached = readCache('…', isPeoplePage);   // → PeoplePage | null, no cast
```

`localStorage` returns `string`; anything parsed from it is `unknown` by definition —
a user can hand-edit it. Joi does the checking; the **predicate signature** is what turns
"I checked" into "the compiler knows". Without the `value is PeoplePage` return type,
every caller would still need a cast and the validation would buy nothing at compile time.

Same pattern for the two typed schemas: `Joi.object<LoginFormValues, true>` and
`Joi.object<PeopleQuery, true>` on the backend. The `true` type argument asserts the
schema covers every key, so `validate()` returns the real type instead of `any` — which
is the difference between Joi improving type safety and quietly destroying it.

## What I'm not doing

- **No Zod / io-ts / Yup.** Joi covers validation: the login form, the cache payload, and
  the backend's query params. One validation library, not two.
- **No Joi schema for the SWAPI response.** The DTO→model mapper reads five known string
  fields; if the API changed shape, the cheap failure is a `—` in a cell, not a crash.
  Validating an 80-field third-party response to consume five of them would be a schema
  written to be immediately outgrown (AGENT.md §2). The **cache** payload is validated
  because that's data we wrote and a user can hand-edit — a genuinely untrusted input.
- **No global `.d.ts` ambient declarations** beyond Vite's own `vite-env.d.ts`
  (which supplies `*.module.scss` and `*.svg` module types). Ambient types that come
  from nowhere are exactly the "where is this from" problem we're avoiding in CSS too.
