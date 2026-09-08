# FE 03 · Login form, validation, disabled button

Covers requirements 1–3: responsive form, both fields non-empty and 4–30 chars, button
disabled while invalid.

## Validation rules (exact reading of the spec)

> *"ensure that neither the username nor the password fields are empty and include
> between 4 to 30 characters"*

So per field: **required**, and **4 ≤ length ≤ 30** (inclusive at both ends).
Note that `required` is already implied by `length >= 4`, but it gets its own error
message because "Username is required" is a better message than "must be at least 4
characters" for an untouched empty field.

| Field | Transform before check | Rules | Message |
|---|---|---|---|
| `username` | `.trim()` | non-empty | `Username is required.` |
| | | `len >= 4` | `Username must be at least 4 characters.` |
| | | `len <= 30` | `Username must be 30 characters or fewer.` |
| `password` | **none** (raw) | non-empty | `Password is required.` |
| | | `len >= 4` | `Password must be at least 4 characters.` |
| | | `len <= 30` | `Password must be 30 characters or fewer.` |

**Why username is trimmed and password isn't:** trailing whitespace in a username is
always a typo (paste artifact), and silently letting `"bob "` differ from `"bob"` is a
classic bug. In a password, a space is a legitimate character — trimming it would
silently change what the user typed. This asymmetry is intentional and gets a one-line
comment in the code so it doesn't read as an oversight.

`maxLength={30}` also goes on both inputs as a native attribute. That makes the >30 rule
practically unreachable by typing — but paste and autofill still produce it, and the
rule is in the spec, so it's implemented in the validator regardless.

## `lib/validation.ts` — Joi schema, no React

```ts
import Joi from 'joi';

export const FIELD_MIN_LENGTH = 4;
export const FIELD_MAX_LENGTH = 30;

export interface LoginFormValues {
  username: string;
  password: string;
}

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

export const loginSchema = Joi.object<LoginFormValues, true>({
  username: Joi.string()
    .trim()                                  // deliberate — see below
    .min(FIELD_MIN_LENGTH)
    .max(FIELD_MAX_LENGTH)
    .required()
    .messages({
      'string.empty':    'Username is required.',
      'any.required':    'Username is required.',
      'string.min':      `Username must be at least ${FIELD_MIN_LENGTH} characters.`,
      'string.max':      `Username must be ${FIELD_MAX_LENGTH} characters or fewer.`,
    }),
  password: Joi.string()                     // no .trim() — deliberate
    .min(FIELD_MIN_LENGTH)
    .max(FIELD_MAX_LENGTH)
    .required()
    .messages({
      'string.empty':    'Password is required.',
      'any.required':    'Password is required.',
      'string.min':      `Password must be at least ${FIELD_MIN_LENGTH} characters.`,
      'string.max':      `Password must be ${FIELD_MAX_LENGTH} characters or fewer.`,
    }),
});

export const validateLoginForm = (values: LoginFormValues): LoginFormErrors => {
  const { error } = loginSchema.validate(values, { abortEarly: false, convert: true });
  if (!error) return {};

  return toFieldErrors(error);
};

// abortEarly: true here — we only need a yes/no, so stop at the first failure
export const isLoginFormValid = (values: LoginFormValues): boolean =>
  loginSchema.validate(values, { abortEarly: true }).error === undefined;
```

```ts
// lib/toFieldErrors.ts — Joi's details array → a per-field record
const toFieldErrors = (error: Joi.ValidationError): LoginFormErrors =>
  error.details.reduce<LoginFormErrors>((collected, detail) => {
    const field = detail.path[0];
    if (typeof field !== 'string') return collected;
    if (collected[field as keyof LoginFormValues] !== undefined) return collected;

    return { ...collected, [field]: detail.message };
  }, {});
```

The four Joi details that actually matter here:

- **`abortEarly: false` is not optional.** Joi's default is to stop at the first failing
  key, so a form with both fields empty would report only `username` — and the user would
  fix errors one at a time, with the button staying disabled for no visible reason. This
  is the easiest Joi mistake to make and the most user-visible.
- **`convert: true`** (Joi's default, stated explicitly for clarity) is what makes
  `.trim()` on `username` actually transform the value rather than just test it. That's
  precisely the username behaviour we want.
- **Custom `.messages()` per rule.** Joi's defaults read
  `"username" length must be at least 4 characters long` — quoted key, awkward grammar.
  Never ship those to a user.
- **`string.empty` and `any.required` both need a message.** `''` triggers `string.empty`,
  a missing key triggers `any.required`. Mapping only one leaves a Joi default leaking
  through in the other case.

`toFieldErrors` keeps the **first** message per field (the `!== undefined` guard), because
with `abortEarly: false` one field can produce several details and we show one line per
field. Note the guard is a flat early-return inside the reducer — no nesting (AGENT.md §3).

> With `exactOptionalPropertyTypes: true`, never assign `undefined` into
> `LoginFormErrors`. The reducer builds the object by spreading only present keys, which
> sidesteps that entirely.

This file is framework-free and exhaustively unit-testable — the tests in
[09-testing-qa.md](09-testing-qa.md) hammer the schema directly, which is the cheapest
place to prove "basic validation" works for the Functionality criterion.

## Component split

```
LoginPage            layout, centering, heading, <LoginForm/>
└─ LoginForm         state, validation orchestration, submit → login() + navigate()
   ├─ Input × 2      ui primitive: label, control, error slot, aria wiring
   └─ Button         ui primitive: variant, disabled, loading
```

`LoginForm` is a *component*, not the page, so the page stays pure layout and the form
could be dropped into a modal later without touching either.

## Form state — plain `useState`, no form library

Two fields and two touched flags. Joi handles the *rules*; it isn't a form library, and
we don't add one. `react-hook-form` / Formik would each be more code than they save for
two inputs — and `react-hook-form` would also want a `joiResolver` adapter on top.

```tsx
const [values, setValues] = useState<LoginFormValues>({ username: '', password: '' });
const [touched, setTouched] = useState<Record<keyof LoginFormValues, boolean>>({
  username: false,
  password: false,
});
const [submitted, setSubmitted] = useState(false);

// derived on every render — NOT state, NOT a useEffect
const errors = validateLoginForm(values);
const canSubmit = Object.keys(errors).length === 0;
```

**The single most important line here:** `errors` and `canSubmit` are *derived during
render*, not stored in state and synced with `useEffect`. Mirroring derived data into
state is the most common React anti-pattern and would cost a render cycle plus a
whole class of stale-value bugs.

`schema.validate()` is **synchronous** (`validateAsync` is the async variant, and we
don't use it), so this stays a plain derived value — Joi doesn't force any async form
state on us. It's a little more work per keystroke than a hand-written check, but it's
two short strings against a compiled schema; measure before reaching for `useMemo`, and
expect not to need it.

## When errors become visible

An error shows for a field when **that field has been blurred** *or* **submit was
attempted**. So the form doesn't scream "Username is required" at someone who hasn't
typed a character yet, but a click on the (disabled) button still explains why.

```tsx
const showError = (field: keyof LoginFormValues) =>
  (touched[field] || submitted) && errors[field] !== undefined;
```

Because the button is disabled while invalid, a real `submit` event can't fire from the
button — so `submitted` is set from an `onClick` on the form's wrapper, or more simply:
the button is disabled *and* every field is auto-blurred, which already reveals errors
after the first interaction. **Decision: keep `submitted`**, and put it on the `<form onSubmit>`
handler, which still fires for Enter-in-a-field when the form is valid, plus set it in a
`onMouseDown` capture on the button's wrapper so a click on a disabled button reveals
both errors at once. If that wrapper trick feels hacky in review, drop it — blur-based
errors alone satisfy the spec.

## The disabled button

```tsx
<Button type="submit" disabled={!canSubmit || isSubmitting}>Log in</Button>
```

Requirement 3 is literally *"disabled when the validation is not successful"*, so
`disabled` (not `aria-disabled`) is correct — the reviewer will look for the real
attribute in DevTools.

Accessibility cost of a truly disabled button is that it's not focusable and announces
nothing. Mitigated by:
- errors are in the DOM next to their inputs and `aria-live="polite"`;
- a short static hint under the form: *"Both fields need 4–30 characters."*

That hint is also the honest answer to "why is the button greyed out" for a sighted
user, which is a UX win, not just an a11y one.

## `Input` primitive — the a11y wiring

```
<div class={styles.field}>
  <label htmlFor={id}>{label}</label>
  <input
    id={id}
    aria-invalid={hasError || undefined}
    aria-describedby={hasError ? errorId : undefined}
    autoComplete={...}
    ...rest
  />
  <p id={errorId} role="alert" class={styles.error}>{error}</p>   // reserved height
</div>
```

- `id` from `useId()` — collision-free without prop drilling an id. The generated format
  is opaque in React 19: never parse it or assert on it in a test.
- **No `forwardRef`.** In React 19 `ref` is a normal prop, so `Input` takes it directly:
  `({ ref, label, error, ...rest }: InputProps)`.
- `aria-invalid={hasError || undefined}` — passing `false` renders `aria-invalid="false"`,
  which is valid but noisier than omitting it.
- The error paragraph **always occupies its line height** (`min-height`) so the layout
  doesn't jump when a message appears. Small detail, very visible in review.
- `autoComplete="username"` and `autoComplete="current-password"`, and the password field
  is `type="password"` inside a real `<form>` — otherwise password managers misbehave.
- Props extend `ComponentPropsWithoutRef<'input'>` so `placeholder`, `maxLength`, etc.
  pass straight through without re-declaring each one.

Nice-to-have if time allows: a show/hide password toggle (`type` swaps between
`password` and `text`, button has `aria-pressed` + `aria-label`). Cheap, and reviewers
notice it.

## Submit flow

> **Updated by [../auth.md](../auth.md):** submit is now **asynchronous** — it posts to
> `/api/auth/login`. The client-side Joi check still gates the button; the server
> re-validates with the same rules, because a client-only check is a UX affordance, not
> validation.

```tsx
const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  setSubmitted(true);
  if (!canSubmit || isSubmitting) return;   // button is already disabled; belt-and-braces

  setServerError(null);
  setIsSubmitting(true);

  try {
    await login(values.username, values.password);   // AuthContext → POST /api/auth/login
    navigate(ROUTES.table, { replace: true });
  } catch (error) {
    setServerError(toLoginErrorMessage(error));
  } finally {
    setIsSubmitting(false);
  }
};
```

Three things this adds over the synchronous version:

- **`isSubmitting` guards double-submit.** Enter held down, or a double-click in the gap
  before the request resolves, would otherwise fire two logins and create two sessions.
- **`serverError` is separate from field `errors`.** Field errors come from Joi and clear
  as you type; a server error ("could not reach the server") is about the request, and is
  cleared on the next submit rather than on the next keystroke. Rendered above the button
  with `role="alert"`.
- **`finally`** resets the in-flight flag on both paths, so a failed login leaves a usable
  form rather than a permanently disabled button.

**No artificial delay.** The request is the wait; nothing is faked. This is also what
finally gives the `Button` primitive's `loading` prop a real caller — it had none in the
original plan, which by AGENT.md §2 would have made it a prop to delete.

## Responsiveness

Single-column card, `width: 100%; max-width: 26rem`, centered with flex + `min-height: 100dvh`.
No breakpoint needed for the form itself — it's fluid by construction. Only the outer
padding steps down on very small screens. Details in [07-styling.md](07-styling.md).

`100dvh` over `100vh` so mobile browser chrome doesn't cut off the card; `100vh` fallback
declared first for older browsers.

## Definition of done

- [ ] Empty form → button disabled, no errors shown yet
- [ ] Type 3 chars, blur → "at least 4 characters", button still disabled
- [ ] 4 valid chars in both → button enabled
- [ ] Paste 40 chars → native `maxLength` caps at 30; validator still rejects >30 if bypassed
- [ ] `"  ab  "` username (6 raw / 2 trimmed) → rejected
- [ ] `"    "` password (4 spaces) → **accepted** (documented, intentional)
- [ ] Enter key submits when valid
- [ ] Tab order: username → password → button; visible focus ring on each
- [ ] After submit, URL is `/table` and Back does not return to the form
