# FE 04 · Table page, data fetching, pagination, loading state

Covers requirements 5–8 and 10.

## The API, verified

`GET https://swapi.py4e.com/api/people/?page=1`

```json
{
  "count": 87,
  "next": "https://swapi.py4e.com/api/people/?page=2",
  "previous": null,
  "results": [
    { "name": "Luke Skywalker", "height": "172", "mass": "77",
      "hair_color": "blond", "skin_color": "fair", "...": "..." }
  ]
}
```

Confirmed facts to design against:

- **87 records, 10 per page → 9 pages.** Page size is the server's, not ours.
- **Every field is a string.** `height: "172"`, not `172`.
- **Sentinel values exist:** `"unknown"`, `"n/a"`, `"none"` (e.g. droids have
  `hair_color: "n/a"`, several have `mass: "unknown"`).
- **`mass` can be comma-grouped:** `"1,358"` (Jabba). So `Number(mass)` → `NaN`.
- **Multi-valued colours:** `skin_color: "white, blue"`, `hair_color: "brown, grey"`.
- **The trailing slash matters.** `/api/people?page=2` 301-redirects to
  `/api/people/?page=2`. Always request the slashed form to save a round trip.

## Pagination: server-side

`?page=N` already exists and already returns exactly the 10 rows we want to show, so the
client mirrors it. The alternative — fetch all 9 pages up front and slice locally —
means 9 requests before first paint to enable a feature the API hands us for free.

Consequences, all of them good:
- first paint after 1 request;
- each page is its own cache entry ([05-caching.md](05-caching.md));
- total page count comes from `Math.ceil(count / PAGE_SIZE)`, not from a guess.

The current page also goes in the **URL as `?page=N`** via `useSearchParams`. Costs
almost nothing and means page 4 is linkable and survives a refresh. The URL is the
single source of truth for which page is showing — not a `useState` that would then
need syncing with it.

```ts
const [searchParams, setSearchParams] = useSearchParams();
const page = clampPage(Number(searchParams.get('page') ?? 1), totalPages);
```

`clampPage` guards `?page=abc` (`NaN`), `?page=0`, `?page=999` — all of which SWAPI
answers with a 404 body `{"detail": "Not found"}`. Clamp before requesting.

## `services/http.ts` — the fetch boundary

One wrapper, so timeout/abort/error-mapping exist in exactly one place:

```ts
export async function requestJson<Payload>(url: string, signal?: AbortSignal): Promise<Payload> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  // combine caller's signal with the timeout signal
  try {
    const response = await fetch(url, { signal: anySignal([signal, timeout.signal]) });
    if (!response.ok) throw new HttpError(response.status, response.statusText, url);
    return (await response.json()) as Payload;
  } catch (error) {
    throw toAppError(error);   // → NetworkError | TimeoutError | HttpError | AbortError
  } finally {
    clearTimeout(timer);
  }
}
```

Why a timeout at all: with DevTools throttled to a very slow profile (or a captive
portal) `fetch` hangs indefinitely and the spinner spins forever. A 10 s cap turns that
into a real, handleable error — which is what requirement 12 asks for.

> `AbortSignal.any([...])` is the modern one-liner but isn't in every target browser;
> `anySignal` is a 6-line helper that wires `addEventListener('abort')` on each input.
> Cheap and dependency-free.

Error taxonomy lives in `lib/errors.ts` — see [06-offline-and-errors.md](06-offline-and-errors.md).
The key distinction: a rejected `fetch` with `TypeError: Failed to fetch` means
**the request never left** (offline, DNS, CORS) → that's the offline path, not a
"server said no" path.

## `services/swapi.ts` — DTO → model at the boundary

```ts
// services/types.ts — raw wire shape, exactly as sent
export interface SwapiPersonDto {
  name: string; height: string; mass: string;
  hair_color: string; skin_color: string;
  /* …other fields exist; we deliberately don't model what we don't use */
}
export interface SwapiPageDto<Item> {
  count: number; next: string | null; previous: string | null; results: Item[];
}
```

```ts
// types/api.ts — what the UI consumes
export interface Person {
  id: string;          // derived from `url` — the API has no id field
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
export const getPeoplePage = async (page: number, signal?: AbortSignal): Promise<PeoplePage> => {
  const cached = readPeoplePage(page);            // cache first — 05-caching.md
  if (cached) return cached;
  const dto = await requestJson<SwapiPageDto<SwapiPersonDto>>(peopleUrl(page), signal);
  const model = mapPeoplePage(dto, page);
  writePeoplePage(page, model);
  return model;
};
```

The snake_case → camelCase mapping isn't ceremony: it means `hair_color` appears in
exactly one file. If SWAPI renames a field, one mapper changes and no component does.

**Row keys:** SWAPI returns no `id`, and `name` is *not* guaranteed unique. The `url`
field (`.../api/people/13/`) is, so `id` is the trailing path segment. Using the array
index as a key would be wrong the moment rows are ever sorted.

## `hooks/usePeople.ts` — the async state machine

Three values must always change together: `status`, `data`, `error`. That's the textbook
`useReducer` case; three `useState` calls invite a render where `status === 'success'`
but `data === null`.

```ts
type PeopleState =
  | { status: 'idle';    data: null;       error: null }
  | { status: 'loading'; data: PeoplePage | null; error: null }  // data kept for "refreshing"
  | { status: 'success'; data: PeoplePage; error: null }
  | { status: 'error';   data: PeoplePage | null; error: AppError };
```

A **discriminated union**, not `{ isLoading: boolean; data?: T; error?: E }`. The union
makes `status: 'success'` with `data: null` unrepresentable, so `state.data.people` needs
no `?.` inside a success branch. This is the single clearest "TypeScript used properly"
signal in the codebase.

```ts
export const usePeople = (page: number) => {
  const [state, dispatch] = useReducer(peopleReducer, initialState);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    dispatch({ type: 'FETCH_START' });
    getPeoplePage(page, controller.signal)
      .then((data) => { if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', data }); })
      .catch((error) => {
        if (cancelled || isAbortError(error)) return;      // never surface our own abort
        dispatch({ type: 'FETCH_ERROR', error: toAppError(error) });
      });

    return () => { cancelled = true; controller.abort(); };
  }, [page, reloadKey]);

  const retry = useCallback(() => setReloadKey((currentKey) => currentKey + 1), []);
  return { ...state, retry };
};
```

Details that matter and are easy to get wrong:

- **`AbortController` in the cleanup.** Click page 2 then 3 quickly and, without this,
  page 2's late response can land after page 3's and render the wrong data. This is the
  bug that makes hand-rolled fetching look bad; it's four lines to prevent.
- **Aborts are swallowed, never shown.** An aborted request is *us* cancelling, not a
  failure. Surfacing it flashes an error banner on every fast click.
- **`retry` bumps a `reloadKey`** in the effect deps rather than calling the fetch
  directly, so retry goes through exactly the same code path (including abort handling)
  as a normal load. One path, one set of bugs.
- **`data` is preserved on `loading` and `error`.** That's what allows "keep the old
  table visible, dim it, show a small spinner" instead of collapsing the layout to a
  skeleton on every page change. Much better perceived performance.

## `TablePage` composition

```
TablePage
├─ header: title, row count ("87 characters"), Log out button
├─ status region (aria-live="polite")
├─ PeopleTable        rows | skeleton | empty
├─ ErrorState         only when status === 'error'
├─ Pagination         disabled while loading
└─ OfflineModal       rendered by App, not here — it's global
```

## Loading state (requirement 10)

Two distinct loading states, because they're perceptually different problems:

| Situation | Treatment |
|---|---|
| **First load** (no `data` yet) | `Skeleton` rows — 10 shimmer rows at the real row height, so the layout is already correct when data lands. No spinner-in-a-void, no CLS. |
| **Page change** (`data` exists) | Table stays, gets `opacity: .55` + `pointer-events: none`, small inline `Spinner` next to the heading. |

Both announce via a visually-hidden `aria-live="polite"` region: "Loading characters…" /
"Showing page 3 of 9." Loading state that only exists visually is half-built.

Cached pages resolve synchronously-ish (no network), so revisiting page 1 shows no
flicker at all — a nice, visible payoff for the caching requirement.

## `PeopleTable` — TanStack Table v8, our own markup

`@tanstack/react-table` is **headless**: it computes column definitions, header groups and
row models, and emits no DOM. We render the markup. That's the whole reason it fits here —
everything below (semantic `<table>`, `<th scope="row">`, `data-label`, the CSS-only
mobile card layout) is unaffected.

### Column definitions

```tsx
// pages/TablePage/elements/PeopleTable/columns.tsx
const columnHelper = createColumnHelper<Person>();

export const peopleColumns = [
  columnHelper.accessor('name', {
    header: 'Name',
    meta: { label: 'Name' },
  }),
  columnHelper.accessor('mass', {
    header: 'Mass',
    meta: { label: 'Mass', align: 'end' },
    cell: (info) => formatMass(info.getValue()),
  }),
  columnHelper.accessor('height', {
    header: 'Height',
    meta: { label: 'Height', align: 'end' },
    cell: (info) => formatHeight(info.getValue()),
  }),
  columnHelper.accessor('hairColor', {
    header: 'Hair color',
    meta: { label: 'Hair color' },
    cell: (info) => <ColorSwatch value={info.getValue()} />,
  }),
  columnHelper.accessor('skinColor', {
    header: 'Skin color',
    meta: { label: 'Skin color' },
    cell: (info) => <ColorSwatch value={info.getValue()} />,
  }),
];
```

Exactly the five specified columns, in the specified order. `createColumnHelper<Person>()`
ties every `accessor` key to the model, so a typo or a renamed field is a compile error
rather than an empty column.

The `meta` field is typed by declaration-merging TanStack's `ColumnMeta` once:

```ts
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    label: string;
    align?: 'start' | 'end';
  }
}
```

Without that, `meta` is `unknown` and every read needs a cast. This is the one place the
plan uses declaration merging, and it's what `interface` is for (see [08-types.md](08-types.md)).

### Table instance

```tsx
const table = useReactTable({
  data: people,
  columns: peopleColumns,
  getCoreRowModel: getCoreRowModel(),
  getRowId: (person) => person.id,  // our SWAPI-url-derived id, never the array index
  manualPagination: true,           // ← the important one
});
```

**`manualPagination: true`, and deliberately no `getPaginationRowModel()`.** Our paging is
server-side: `data` is already exactly the 10 rows for the current page. Wiring TanStack's
pagination row model would page a single page — a classic and confusing bug. Our own
`Pagination` element keeps driving `?page=N`.

Also not wired: `getSortedRowModel`, `getFilteredRowModel`. Sorting across the full 87
records would need a server that supports it (SWAPI doesn't), and sorting only the visible
10 is a worse-than-useless feature. One line to add later if the data source gains support.

**`data` must be referentially stable** across renders, or TanStack rebuilds the row model
every time. It comes straight out of `usePeople`'s reducer state, so it only changes when
a fetch resolves — stable by construction. Worth knowing, because passing
`data={people ?? []}` inline would create a new array every render.

### Rendering — semantics first

A real `<table>`. Not divs with `display: grid`, not `role="table"` on a div — the mobile
card layout in [07-styling.md](07-styling.md) is achieved with CSS alone, so the
semantics survive at every width.

Target output — identical to what a hand-written table would produce:

```html
<table>
  <caption class="visually-hidden">Star Wars characters, page 3 of 9</caption>
  <thead>
    <tr><th scope="col">Name</th><th scope="col">Mass</th>…</tr>
  </thead>
  <tbody>
    <tr><th scope="row">Luke Skywalker</th><td data-label="Mass">77 kg</td>…</tr>
  </tbody>
</table>
```

Driven from the table instance with `flexRender`:

```tsx
<tbody>
  {table.getRowModel().rows.map((row) => (
    <PersonRow key={row.id} row={row} />
  ))}
</tbody>
```

`PersonRow` is its own element ([00-architecture.md](00-architecture.md)) and owns the
per-cell element choice:

```tsx
// pages/TablePage/elements/PeopleTable/elements/PersonRow/PersonRow.tsx
export const PersonRow = ({ row }: PersonRowProps) => (
  <tr className={styles.row}>
    {row.getVisibleCells().map((cell) => {
      const { label, align } = cell.column.columnDef.meta ?? { label: '' };
      const content = flexRender(cell.column.columnDef.cell, cell.getContext());

      if (cell.column.id === NAME_COLUMN_ID) {
        return <th key={cell.id} scope="row" className={styles.nameCell}>{content}</th>;
      }

      return (
        <td key={cell.id} data-label={label} data-align={align}>
          {content}
        </td>
      );
    })}
  </tr>
);
```

- **`<th scope="row">` for the name cell** — it labels its row, which is what screen
  readers need to make the other cells meaningful. TanStack emits no markup, so this
  choice stays ours; the `if` is a flat guard with an early return inside a callback, so
  nesting depth is 1 (AGENT.md §3).
- **`data-label={label}`** comes from `meta.label` and feeds the mobile layout's `::before`.
  Zero extra DOM, and the label can't drift from the column header.
- **`row.id`** is TanStack's stable row id, derived from our `getRowId` (set to
  `person.id`), not the array index — see the row-keys note above.
- **Columns exactly as specified:** name, mass, height, hair color, skin color — in that
  order, enforced by `peopleColumns`.
- `<thead>` renders from `table.getHeaderGroups()` with `<th scope="col">`. We have one
  header group (no grouped columns), but reading it from the instance rather than
  hardcoding keeps headers and cells from ever disagreeing.

### Was TanStack worth it here?

Honestly: for 5 fixed columns and 10 rows, `people.map()` would be less code, and this
brushes against AGENT.md §2. It's in the stack because it was asked for, and it does pay
for itself in three ways — column definitions type-checked against `Person`, per-column
formatting co-located with the column instead of scattered through JSX, and
`getSortedRowModel()` becoming a one-line addition. The cost is ~14 KB gzipped and the
`manualPagination` footgun above.

### Display formatting (`lib/format.ts`)

| Raw | Rendered | Rule |
|---|---|---|
| `"172"` | `172 cm` | numeric-looking → append unit |
| `"77"` | `77 kg` | numeric-looking → append unit |
| `"1,358"` | `1,358 kg` | keep the grouping as sent; don't re-parse |
| `"unknown"` | `—` | sentinel → em dash, with `title="unknown"` |
| `"n/a"` / `"none"` | `—` | same |
| `"blond"` | `Blond` | capitalise first letter |
| `"white, blue"` | `White, blue` | capitalise once, not per word |

Units are added because a bare `172` in a "Height" column is ambiguous, and SWAPI's
units are documented (cm / kg). The sentinel → `—` mapping keeps the grid clean; the
`title` attribute means no information is lost. A colour column additionally gets a small
swatch dot where the value maps to a real CSS colour — purely decorative,
`aria-hidden="true"`, and skipped for multi-valued or sentinel values.

## `Pagination` — "basic", done properly

```
[‹ Prev]  1 … 3 [4] 5 … 9  [Next ›]
```

- Windowed page numbers (first, last, current ±1, ellipses) so 9 pages fit and 90 would too.
- `Prev` disabled on page 1, `Next` on the last page; all buttons disabled while loading.
- `<nav aria-label="Pagination">`, current page marked `aria-current="page"`.
- Real `<button>`s, driven by `setSearchParams` — so no anchor that reloads the app.
- Below the controls, a plain "Page 4 of 9 · showing 31–40 of 87" line. Derived from
  `count`, free to compute, and it's what tells a reviewer the paging is real rather
  than cosmetic.
- On mobile the number strip collapses to `Prev / 4 of 9 / Next` — tap targets ≥ 44 px.

## Definition of done

- [ ] `/table` shows 10 rows, correct 5 columns, on first load
- [ ] `Next` advances URL to `?page=2` and loads different rows
- [ ] Refresh on `?page=4` restores page 4
- [ ] `?page=abc`, `?page=0`, `?page=99` all clamp to a valid page without a crash
- [ ] Skeleton on cold load; dimmed-table + spinner on page change
- [ ] Rapid Prev/Next clicking never leaves the wrong page's data on screen
- [ ] `mass: "unknown"` renders `—`, `mass: "1,358"` renders `1,358 kg`
- [ ] Second visit to page 1 hits the cache (no network row in DevTools)
