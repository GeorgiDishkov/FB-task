# Phase 7 · Outcome

Status: **complete.** Responsive and accessibility pass over the finished app, driven by
the matrix in [FE/09-testing-qa.md](FE/09-testing-qa.md) and the targets in
[FE/07-styling.md](FE/07-styling.md).

Mostly a verification phase — but it found **three real defects**, two of which the plan
had explicitly (and wrongly) claimed were fine.

---

## Three defects found and fixed

### 1. The sticky table header never stuck

`.wrapper { overflow-x: auto }` was intended to allow horizontal scrolling. But **setting
one overflow axis to a non-`visible` value forces the other to compute as `auto`**, so the
wrapper became the nearest scrolling ancestor — and `position: sticky` on the `<th>`
resolved against a box that never scrolls vertically.

Measured, at a viewport short enough for the page to scroll:

| | Before | After |
|---|---|---|
| `wrapper` computed `overflow-y` | `auto` | `visible` |
| Header `top` after scrolling 380 px | **−229 px** (gone) | **0 px** (pinned) |

[FE/07-styling.md](FE/07-styling.md) had claimed *"the wrapper uses `overflow-x: auto`
which is fine"*. It was not fine. The fix removes the overflow entirely — it was dead
weight, because `table-layout: fixed` plus `overflow-wrap: anywhere` means the table
cannot exceed its container at any width.

Confirmed properly rather than by eyeballing: `document.elementFromPoint` at the header's
centre **and** its top edge both return the `TH`, with an opaque background and body rows
(C-3PO, R2-D2) passing behind it.

### 2. The production build could not authenticate

`vite preview` serves on **4173**, but `CORS_ORIGIN` defaulted to `5173` only — so
`npm run preview` failed every auth request with a CORS error. A confusing way to discover
that auth is origin-restricted, and it would have bitten anyone checking the built app.

`CORS_ORIGINS` is now a comma-separated allow-list defaulting to both local origins.
Still an explicit list, never `*` — and it has to be, since `credentials: true` is
incompatible with a wildcard. Verified: both localhost origins are echoed back,
`http://evil.example` gets no `Access-Control-Allow-Origin` header at all.

### 3. Equal column widths cramped the name

`table-layout: fixed` distributes width equally by default, giving a two-character mass
the same room as "Beru Whitesun lars". Now proportional — Name 28%, Mass and Height 15%
each, Hair and Skin 21% each, so **253 / 135 / 135 / 189 / 189 px** at desktop.
Percentages rather than pixels so the proportions hold at every width, and fixed layout
still guarantees nothing shifts between pages.

---

## Responsive: verified at real viewport widths

An early attempt measured layout by constraining `#root`'s width. **That was invalid** —
media queries respond to the viewport, not an element — and it reported the card layout
never activating. Redone with real viewport resizes.

| Width | Result |
|---|---|
| **320** | No horizontal overflow (`scrollWidth === 320`); card layout active (`display: grid`); labels from `data-label`; still a real `<table>` with `<th scope="row">`; `thead` `position: absolute` (visually hidden, still in the a11y tree) |
| **767** | Card layout, pseudo-labels present, page-number strip hidden |
| **768** | Table layout, `thead` static and visible, no pseudo-labels, number strip visible |
| **1024 / 1440** | No overflow; content capped at `72rem` and centred rather than stretched |

**The breakpoint boundary is exactly complementary** — `767.98px` for the card layout
against `min-width: 768px` for the table. At 767 the card rules apply and the table rules
do not; at 768 the reverse. No 1 px gap where neither applies, which was the specific risk
of mixing `min-` and `max-width` queries.

Login and Not-found pages also checked at 320: no overflow, inputs at 16 px (no iOS
focus-zoom), submit button 50 px tall, card fits the viewport.

---

## Accessibility

| Check | Result |
|---|---|
| Landmarks | 1 `main`, 1 `nav` (labelled "Pagination"), 1 `header` |
| Headings | single `h1` per page; `h2` only inside the modal |
| `lang` | `en` |
| Unlabelled controls | **none** — every control has text, `aria-label`, or an associated `<label>` |
| Table semantics | `<caption>` ("page 1 of 9"), `<th scope="col">` headers, `<th scope="row">` names |
| Live regions | `role="status" aria-live="polite"` announcing "Showing page 1 of 9." |
| Tap targets | every **visible** button ≥ 50 px tall / 75 px wide |
| Contrast (9 elements) | all pass AA; **lowest 7.21** (table header), most 16.17 |
| Reduced motion | all 4 animated selectors — spinner ring, modal backdrop, modal panel, skeleton bar — have matching `prefers-reduced-motion` overrides, plus the global catch-all |

**Focus rings**: an automated sweep reported every button as having no outline. That was a
measurement artifact — a scripted `.focus()` does not trigger `:focus-visible`. Re-tested
with real `Tab` keypresses: `matchesFocusVisible: true`, `2px solid rgb(125, 211, 252)` at
`2px` offset, and clearly visible in a screenshot. Five `:focus-visible` rules exist
(Button, Modal panel, Input, PageButton, plus the global baseline).

A "smallest tap target = 0" reading was likewise explained rather than accepted: the only
zero-height buttons are the page-number strip, which is deliberately `display: none`
below `md`.

---

## Build hygiene

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings at `--max-warnings 0` |
| `npm run build` | clean, both workspaces |
| `npm test` | 76 passing in 8 files |
| `npx prettier --check .` | clean |
| SCSS `@import` | **0** — `@use` only, no deprecation warnings |
| Bare `z-index` outside `_tokens.scss` | **0** |
| Hardcoded hex outside tokens/global | **0** |
| `console.log` in client `src/` | **0** (server keeps two deliberate boot logs and one error log) |
| `TODO` / `FIXME` / `XXX` | **0** |
| `any` / `@ts-ignore` / `@ts-expect-error` | **0** |
| **`eslint-disable` comments** | **0** across the whole codebase — consistent with AGENT.md §8, which requires exceptions be recorded in that file rather than scattered inline |

## Production build, end to end

`npm run build && vite preview` on 4173:

- deep links all serve the SPA shell: `/`, `/table`, `/table?page=4`, `/nope` → 200
- correct `<title>`, hashed bundle referenced
- `/table?page=3` while signed out → redirected to the login page
- signed in → table renders with the five correct columns
- **hard reload of `/table?page=6`** → page 6 restored, "showing 51–60 of 87", windowed
  pagination `‹ Prev 1 … 5 6 7 8 9 Next ›`

That pagination is worth noting: `8` appears rather than an ellipsis, because the gap
between 7 and 9 would hide exactly one page — the Phase 4 fix working in the built app.

## Not done

- **Lighthouse was not run** — no way to drive it from here. The checks above cover its
  accessibility audit item by item (landmarks, headings, labels, contrast, `lang`, table
  semantics), but I have not produced a Lighthouse score and will not claim one.
- No skip-link. Worth adding if the header ever grows; with three controls before the
  table it is not yet earning its place.
