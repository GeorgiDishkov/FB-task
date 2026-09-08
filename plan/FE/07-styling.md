# FE 07 · SCSS modules, tokens, responsiveness

Covers requirements 9 (*"visually appealing and responsive"*) and the Responsiveness
criterion.

## Why CSS Modules + SCSS

Requested, and the right call: class names are hashed per file, so there is **no global
namespace to pollute and no BEM naming discipline to maintain**. In DevTools a class
reads `PeopleTable__row___a1b2c`, which tells you which file to open — that's the
"don't make a mess in the DOM / know where the CSS is called from" goal.

SCSS on top gives nesting (for `:hover` / `&--modifier` / media queries co-located with
the selector), `@use` for real module scoping, and maps + mixins for the breakpoint
helper. No Tailwind: it would put the whole design system in `className` strings, which
is the opposite of what was asked for.

## `styles/_tokens.scss` — the only place values are defined

Two-layer approach: **Sass variables** for things needed at compile time (breakpoints,
maps), **CSS custom properties** for anything a component might override or that should
respond to a media query (colours, especially for dark mode).

```scss
// _tokens.scss
$font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

// spacing — a 4px scale, referenced as tokens.space(3)
$space-unit: 0.25rem;
@function space($steps) { @return $space-unit * $steps; }

$radius-sm: 6px;  $radius-md: 10px;  $radius-lg: 16px;  $radius-pill: 999px;

$z-table-header: 10;
$z-modal-backdrop: 100;
$z-modal-panel: 101;
```

```scss
// global.scss
:root {
  --c-bg:            #0b0f1a;   // dark-first: the app is a Star Wars data console
  --c-surface:       #141a29;
  --c-surface-2:     #1b2334;
  --c-border:        #263048;
  --c-text:          #e8ecf5;
  --c-text-muted:    #93a0bd;
  --c-accent:        #ffd166;   // saber-gold, used sparingly
  --c-accent-ink:    #1a1200;
  --c-danger:        #ff6b6b;
  --c-success:       #4ade80;
  --c-focus:         #7dd3fc;

  --shadow-md: 0 4px 16px rgb(0 0 0 / 0.35);
  --shadow-lg: 0 12px 40px rgb(0 0 0 / 0.5);

  --header-h: 3.5rem;
}
```

A single `z-index` scale in one file is the cheap fix for the modal-behind-the-header
class of bug. Every `z-index` in the app references it; no bare numbers.

**Colour contrast is checked, not assumed:** `--c-text` on `--c-bg` and
`--c-text-muted` on `--c-surface` must clear 4.5:1, and `--c-accent-ink` on `--c-accent`
likewise. Muted grey-on-dark is the usual failure — verified with the DevTools contrast
readout during Phase 6.

> Dark-first is a deliberate aesthetic choice (it suits the subject and reads as
> intentional design rather than default-bootstrap). Because colours are custom
> properties, a `@media (prefers-color-scheme: light)` block re-declaring the same ~10
> variables is all a light theme would take — noted, not necessarily built.

## `styles/_breakpoints.scss`

```scss
$breakpoints: (
  'sm': 480px,
  'md': 768px,
  'lg': 1024px,
  'xl': 1280px,
);

@mixin respond-to($name) {
  $breakpoint: map.get($breakpoints, $name);
  @if not $breakpoint { @error 'Unknown breakpoint: #{$name}'; }
  @media (min-width: $breakpoint) { @content; }
}
```

**Mobile-first, `min-width` only.** Mixing `min-` and `max-width` queries is how you get
a 1px gap at a boundary where neither rule applies. The `@error` means a typo'd
breakpoint name fails the build instead of silently emitting nothing.

Usage:

```scss
@use 'breakpoints' as breakpoints;
@use 'tokens' as tokens;

.grid {
  display: grid;
  gap: tokens.space(3);
  grid-template-columns: 1fr;
  @include breakpoints.respond-to('md') { grid-template-columns: repeat(2, 1fr); }
}
```

## `styles/_mixins.scss`

| Mixin | Use |
|---|---|
| `focus-ring` | `outline: 2px solid var(--c-focus); outline-offset: 2px;` applied via `:focus-visible` — one definition, consistent everywhere, and `:focus-visible` means no ring on mouse clicks |
| `visually-hidden` | for `<caption>`, `aria-live` regions, skip link |
| `truncate` | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |
| `card` | surface + border + radius + shadow, used by the login card and modal panel |
| `tap-target` | `min-height: 44px; min-width: 44px;` for mobile controls |

## `global.scss` — the minimal reset

- `*, *::before, *::after { box-sizing: border-box; }`
- `body { margin: 0; font-family: tokens.$font-sans; background: var(--c-bg); color: var(--c-text); -webkit-font-smoothing: antialiased; }`
- `img, svg { display: block; max-width: 100%; }` — kills the inline-descender gap
- `button, input { font: inherit; color: inherit; }` — form controls don't inherit by default
- `:focus-visible { @include focus-ring; }` as a baseline
- `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }`
- **No CSS framework, no normalize.css.** ~20 lines covers what this app needs.

## Login page responsiveness

Fluid by construction, so almost no breakpoints:

```scss
.page {
  min-height: 100vh;
  min-height: 100dvh;        // dvh after vh: mobile browser chrome doesn't clip the card
  display: grid;
  place-items: center;
  padding: tokens.space(4);
}
.card {
  @include mixins.card;
  width: 100%;
  max-width: 26rem;          // the only "breakpoint" the form needs
  padding: tokens.space(6);
  @include breakpoints.respond-to('sm') { padding: tokens.space(8); }
}
```

- `font-size: 16px` minimum on inputs — **iOS Safari zooms the viewport on focus for
  anything smaller.** Extremely common bug, invisible on desktop.
- The card is centred with `grid` + `place-items`, not absolute positioning + transforms,
  so it grows naturally when an error message appears.

## The responsive table — this is the interesting part

A `<table>` is the semantically correct element, but 5 columns × long values doesn't fit
375px. Three options:

| Option | Verdict |
|---|---|
| Horizontal scroll wrapper | Fine, but 5 columns means constant scrubbing; the name column scrolls out of view and rows lose their label |
| Swap to a card `<div>` layout under `md` | Duplicates the markup or throws away table semantics |
| **Keep one `<table>`; restyle rows as cards under `md` with CSS only** | ✅ chosen |

```scss
// desktop / tablet: a real table
.table {
  width: 100%;
  border-collapse: collapse;
  th { position: sticky; top: 0; background: var(--c-surface-2); z-index: tokens.$z-table-header; }
  tbody tr:nth-child(even) { background: rgb(255 255 255 / 0.02); }
  tbody tr:hover { background: rgb(255 255 255 / 0.05); }
}

// mobile: each row becomes a card, each cell a label/value line
@media (max-width: 767.98px) {
  .table thead { @include mixins.visually-hidden; }   // hidden visually, kept for a11y

  .table tr {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: tokens.space(1) tokens.space(3);
    @include mixins.card;
    margin-bottom: tokens.space(3);
    padding: tokens.space(4);
  }

  .table td::before {
    content: attr(data-label);        // ← the label comes from the DOM attribute
    color: var(--c-text-muted);
    font-size: 0.8125rem;
  }

  .table th[scope='row'] {            // the name: full-width card title
    grid-column: 1 / -1;
    font-size: 1.0625rem;
  }
}
```

Notes:

- `data-label` on every `<td>` ([04-table-page.md](04-table-page.md)) is what makes this
  work with **zero extra DOM and zero JS**. One table, two layouts.
- `thead` is `visually-hidden` rather than `display: none` — `display: none` removes it
  from the accessibility tree, so screen-reader users would lose the column names.
  (Caveat: `display: grid` on `<tr>` does drop the native table semantics in some AT.
  Mitigation is the per-cell `data-label` text, which makes each cell self-describing —
  a deliberate trade, and it's the standard approach for this pattern.)
- `767.98px` not `768px` — a `max-width: 768px` here plus `min-width: 768px` in
  `respond-to('md')` would both match at exactly 768px.
- **Sticky header** (`position: sticky` on `th`) needs the scroll container to *not* have
  `overflow: hidden`; the wrapper uses `overflow-x: auto` which is fine.
- `tbody tr:hover` is skipped on touch (`@media (hover: hover)`) — otherwise the hover
  state sticks after a tap.

The desktop table also gets:
- `table-layout: fixed` + explicit column widths so the layout doesn't reflow between
  pages as content lengths change (a very visible jitter otherwise);
- numeric columns right-aligned with `font-variant-numeric: tabular-nums`, so digits line up;
- a wrapper with `overflow-x: auto` and `-webkit-overflow-scrolling: touch` for the
  tablet range where it's *nearly* wide enough.

## Skeleton & spinner

- `Skeleton`: a `linear-gradient` shimmer via `background-position` animation. Sized to
  the **real row height** so nothing shifts when data arrives (CLS = 0).
- `Spinner`: a bordered circle with `border-top-color: transparent` + `rotate`. `role="status"`
  with a visually-hidden "Loading" label.
- Both respect `prefers-reduced-motion` (shimmer → static tint, spin → static ring).

## Target widths to verify (Phase 6)

| Width | What must be true |
|---|---|
| 320 px | nothing overflows horizontally; table is card layout; tap targets ≥ 44px |
| 375 px | card table reads cleanly; pagination is `Prev / 4 of 9 / Next` |
| 768 px | table switches to real columns; header sticky |
| 1024 px | comfortable line lengths; table max-width so it isn't stretched thin |
| 1440 px+ | content capped (`max-width: 72rem`, centred) rather than spanning the screen |

Checked with DevTools device toolbar **and** by dragging the window — the two don't
always agree, particularly around scrollbar width.

## Definition of done

- [ ] No horizontal page scroll at 320px anywhere in the app
- [ ] Login input `font-size` ≥ 16px (no iOS zoom on focus)
- [ ] Table is a real `<table>` at every width; `thead` never `display: none`
- [ ] Every interactive element has a visible `:focus-visible` ring
- [ ] Text/background contrast ≥ 4.5:1 for all body copy, verified in DevTools
- [ ] `prefers-reduced-motion` kills the shimmer, spin, and modal transition
- [ ] No `z-index` literal outside `_tokens.scss`
- [ ] Zero `@import` in SCSS — `@use` only, no deprecation warnings in the build log
