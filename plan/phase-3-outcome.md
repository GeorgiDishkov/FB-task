# Phase 3 · Outcome

Status: **complete and verified.** Requirements 1–3 are done: a responsive login form,
4–30 character validation on both fields, and a login button disabled while invalid.

Built to [FE/03-login-form.md](FE/03-login-form.md), with the async submit from
[auth.md](auth.md).

## What landed

```
client/src/
├─ lib/
│  ├─ validation.ts              Joi loginSchema, validateLoginForm, isLoginFormValid
│  └─ validation.test.ts         16 cases
├─ components/ui/
│  ├─ Input/                     label + control + reserved error slot, a11y wired
│  └─ Button/                    variant + isLoading
└─ pages/LoginPage/
   ├─ LoginPage.tsx              pure layout
   └─ elements/LoginForm/
      ├─ LoginForm.tsx           values, touched, derived errors, render
      ├─ useLoginSubmit.ts       the network side
      ├─ types.ts
      └─ LoginForm.test.tsx      8 cases
```

`TablePage`'s logout now uses the shared `Button` with `variant="secondary"` — which is
the second caller that justified the prop existing at all.

## Verified in the browser

| Check | Result |
|---|---|
| Empty form | button **disabled**, no errors shown, `aria-invalid` **absent** (not `"false"`) |
| Labels | `htmlFor` resolves to the `useId` value (`_r_0_`), so clicking the label focuses the field |
| 3 characters + blur | "Password must be at least 4 characters.", red border, button still disabled |
| The invalid field | `aria-invalid="true"`, `aria-describedby` resolving to the actual message text |
| The untouched field | no error shown — the form doesn't scold before you've typed |
| **Layout shift when an error appears** | **0 px** — form height 312.5 px with and without the message |
| Both fields valid | button enabled |
| Submit | one `POST /api/auth/login` → 200, navigates to `/table` |
| `maxLength` | 30, enforced natively on both inputs |
| Tab order | username → password → submit; 2px focus ring in `--c-focus` |
| 320 px | no horizontal overflow, inputs 16px (no iOS zoom), button 44px |
| Contrast | text 14.67, muted 7.97, danger 7.15, accent-ink on accent 12.88 — all clear 4.5:1 |

The zero layout shift is the reserved-height error slot doing its job: the `<p>` is always
in the DOM with a fixed line height, so revealing a message moves nothing below it.

## Tests: 29 passing across 4 files

`validation.test.ts` (16) — table-driven over both fields: empty, whitespace-only, below
minimum, padded-but-short-when-trimmed, above maximum, exactly the minimum, exactly the
maximum. Plus three that guard specific decisions:

- **A password of four spaces is valid.** Pins the deliberate asymmetry (`.trim()` on the
  username schema, none on the password) so a future "just add `.trim()` to both" fails
  loudly instead of silently redefining what counts as a valid password.
- **Both fields report at once** when both are invalid — the regression guard for
  `abortEarly: false`. With Joi's default only one key comes back.
- **No message contains a `"` character** — Joi's built-in messages quote the key
  (`'"username" length must be…'`), so this asserts every reachable rule has a custom
  override, including the `string.empty` / `any.required` pair that is easy to half-cover.

`LoginForm.test.tsx` (8) — covers requirements 2 and 3 end to end: disabled on empty,
error after blur, enabled once valid, native 30-character cap, spaces-only password
accepted, **the trimmed username and the raw password are what get submitted**, and a
server failure surfaces without leaving the form disabled.

## Four findings, all fixed in the code rather than by relaxing a rule

1. **Three competing assertive live regions.** `Input` had `role="alert"` on every
   reserved error slot, so the two field slots plus the form-level server error were all
   assertive — and `findByRole('alert')` was ambiguous. Field errors are now
   `aria-live="polite"` and only the server error is `role="alert"`. A field message
   should not interrupt what you are doing; a failed sign-in should. The test failure was
   the symptom of a real design problem, not a test problem.
2. **`jsx-a11y/no-autofocus`** on the username field. Removed `autoFocus` rather than
   suppressing the rule — it was a nicety, and the rule's reasoning (disorienting for
   screen-reader users, skips page context) is sound.
3. **`max-lines-per-function`** — `LoginForm` reached 77 lines. Extracted
   `useLoginSubmit` (call the API, navigate, translate a failure into a readable message),
   leaving the component responsible only for values, touched state, derived errors and
   rendering. Genuine separation, not a length trick.
4. **`max-nested-callbacks`** in `validation.test.ts` — `describe → it → flatMap` is
   three. Hoisted the cases and the collection helper to module scope and swapped
   `.forEach` for `for…of`.

## Deviations from the plan

| Plan | Built | Why |
|---|---|---|
| A `submitted` flag revealing errors on submit attempt | **Dropped** | With a genuinely `disabled` submit button, a submit event cannot fire while the form is invalid — so `submitted` could never reveal anything. It was dead state (AGENT.md §2). Blur-based errors plus the static hint cover the same ground. The plan also floated an `onMouseDown` wrapper trick to work around this; that is dropped too. |
| `lib/toFieldErrors.ts` as its own module | Private function inside `validation.ts` | One caller (§2) |
| `elements/FormHint` component | Inlined `<p>` | One paragraph, one caller |
| `Button` with `variant`, `size`, `isLoading` | `variant` (2 values) + `isLoading` | `size` had no second caller; `ghost`/`danger` variants had none either |
| `error?: string` on `Input` | `error?: string \| undefined` | `exactOptionalPropertyTypes` distinguishes an absent prop from one explicitly `undefined`, and "no error" is a real value the caller derives and passes |
| — | `useLoginSubmit` hook | Not in the plan; see finding 3 |

## The Joi bundle cost, measured

| | Raw | Gzipped |
|---|---|---|
| End of Phase 2 | 236 kB | 76 kB |
| End of Phase 3 | 386 kB | 120 kB |
| **Joi's contribution** | **+150 kB** | **+44 kB** |

The plan estimated "~40 KB gzipped" for Joi, so that projection was accurate. It remains
the honest cost of one schema definition shared in spirit with the server's, and the
schema is isolated in `lib/validation.ts` if it ever needs swapping for something smaller.

## Still open

- **Enter-to-submit remains unverified through a real key event** — the harness's
  synthetic `Return` does not trigger the browser's implicit form submission. The submit
  path itself is proven (button click, and `requestSubmit()` in Phase 2), and the form is
  structurally correct: a single `<form>` with an `onSubmit` handler and a
  `type="submit"` button. Stays on the manual QA list (L8).
- A show/hide password toggle was floated in the plan as a nice-to-have. Not built.

## Verified

- [x] `npm run build` — clean
- [x] `npm run lint` — 0 errors, 0 warnings across both workspaces at `--max-warnings 0`
- [x] `npm test` — 29 passing in 4 files
- [x] `npx prettier --check .` — clean
