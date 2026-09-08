# FE 09 · Testing & manual QA

Tests aren't in the requirements, and the timeframe is two days. So the strategy is
**narrow and high-signal**: unit-test the two pure modules where a bug would be invisible
in a demo, and cover everything else with a written manual matrix.

## Automated: two files, ~30 assertions

`vitest` + `jsdom`. No component tests in the first pass — RTL setup, router wrapping and
fetch mocking cost more time than they'd buy here, and the UI is verified by hand anyway.

### `lib/validation.test.ts`

Tests the **Joi schema** through `validateLoginForm` / `isLoginFormValid` — not Joi's
internals. Table-driven with `it.each`:

| Input | Expected |
|---|---|
| `''` | required error |
| `'   '` (username) | required error (trimmed) |
| `'abc'` | min-length error |
| `'abcd'` | valid |
| `'a'.repeat(30)` | valid |
| `'a'.repeat(31)` | max-length error |
| `'  ab  '` (username, 6 raw / 2 trimmed) | min-length error |
| `'    '` (password, 4 spaces) | **valid** — asserts the documented raw-length rule |
| both valid | `isLoginFormValid → true`, `validateLoginForm → {}` |
| one invalid | `isLoginFormValid → false`, only that key present |

The 4-space password case is the most useful test in the file: it pins the deliberate
asymmetry from [03-login-form.md](03-login-form.md) — `.trim()` on the username schema,
none on the password — so a future "just add `.trim()` to both" fails loudly instead of
silently changing behaviour.

Two Joi-specific assertions worth adding, because both are configuration mistakes rather
than logic mistakes and neither is visible in normal use:

- **both fields invalid → both keys present in the returned errors.** This is the
  regression test for `abortEarly: false`. With Joi's default, only `username` comes back
  and the test fails.
- **no error message contains a `"` character.** Joi's built-in messages quote the key
  (`"username" length must be…`); this asserts every rule we hit has a custom
  `.messages()` override, including the `string.empty` / `any.required` pair that's easy
  to half-cover.

### `lib/cache.test.ts`

The checklist from [05-caching.md](05-caching.md) — round-trip, missing key, corrupt JSON,
wrong version, expired, future `savedAt`, failing predicate, throwing `setItem`.

Two things to set up correctly:
- `vi.useFakeTimers()` + `vi.setSystemTime()` for expiry, so no test sleeps.
- `localStorage.clear()` in `beforeEach` — jsdom shares it across tests in a file, and a
  leaked key makes an unrelated test pass for the wrong reason.
- the throwing-`setItem` case via `vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota'); })`.

### If time remains (in priority order)

1. `LoginForm` with RTL: type 3 chars → button `disabled`; type 4 → enabled; submit →
   `login` called with the trimmed username. Highest-value component test by far, since
   it covers requirements 2 and 3 end to end.
2. `usePeople` with a stubbed service: asserts the abort-on-page-change behaviour, which
   is the subtlest bug in the app.
3. `Pagination`: `Prev` disabled on page 1, `Next` disabled on the last page.

## Manual QA matrix

Run before pushing the final commit. Ticked in the repo README so the reviewer can see
what was actually checked.

### Login (requirements 1–3)

| # | Step | Expected |
|---|---|---|
| L1 | Load `/` | Button disabled, no error text visible |
| L2 | Focus then blur username, empty | "Username is required." |
| L3 | Type `abc` | "at least 4 characters", button disabled |
| L4 | `abcd` / `abcd` | No errors, button **enabled** |
| L5 | Paste 40 chars | Native `maxLength` caps at 30 |
| L6 | `  ab  ` username | Rejected (trimmed to 2) |
| L7 | 4 spaces as password | Accepted (documented) |
| L8 | Enter key with valid form | Navigates to `/table` |
| L9 | Keyboard only: Tab → Tab → Enter | Works; focus ring visible at each stop |
| L10 | Back button after login | Does **not** return to the form |
| L11 | Direct-navigate `/table` while logged out | Redirected to `/` |
| L12 | Refresh on `/table` while logged in | Stays on `/table`, no flash of login |
| L13 | Log out | Back to `/`; `/table` now redirects |

### Auth — JWT, sessions, refresh ([../auth.md](../auth.md))

| # | Step | Expected |
|---|---|---|
| A1 | Log in, then hard-refresh `/table` | Still signed in — no flash of the login form, no redirect |
| A2 | Log out | `/table` redirects to `/`; the refresh cookie is gone from DevTools → Application → Cookies |
| A3 | Inspect `localStorage` and `sessionStorage` after login | **No token in either** — access token is in memory, refresh token is `httpOnly` |
| A4 | Set `ACCESS_TOKEN_TTL=30s`, log in, wait, change page | Exactly **one** `POST /api/auth/refresh`, then the data request succeeds; no visible interruption |
| A5 | Replay an old refresh token (copy the cookie value, refresh twice) | Second use returns 401 `SESSION_REVOKED` and kills the session |
| A6 | Restart the server while signed in | Next refresh gives `SESSION_EXPIRED`; the client returns to `/` cleanly rather than hanging |
| A7 | Trigger concurrent 401s (throttle, then click Next rapidly with an expired token) | Exactly **one** refresh call, not one per request |
| A8 | Delete the refresh cookie manually, then reload `/table` | Bootstraps to `anonymous` and redirects — no infinite spinner |
| A9 | Start the server with `JWT_SECRET` unset | Refuses to boot with an actionable message |
| A10 | `curl` `/api/people` with no `Authorization` header | 401 `UNAUTHENTICATED` |
| A11 | `curl` `/api/people` with a tampered JWT payload | 401 — signature check fails |
| A12 | Login with a 3-character password via `curl` (bypassing the form) | 400 — the server validates too, not just the client |

A4 and A7 are the two worth demonstrating: A4 proves refresh works, A7 proves it doesn't
stampede. A12 proves the client-side Joi check is an affordance, not the validation.

### Table (requirements 5–8, 10)

| # | Step | Expected |
|---|---|---|
| T1 | First load | Skeleton → 10 rows, 5 correct columns |
| T2 | Columns | name, mass, height, hair color, skin color — in that order |
| T3 | Next | URL `?page=2`, different rows, header stays |
| T4 | Last page (9) | 7 rows (87 = 8×10 + 7), `Next` disabled |
| T5 | Refresh on `?page=4` | Page 4 restored |
| T6 | `?page=abc` / `?page=0` / `?page=99` | Clamped, no crash |
| T7 | Click Next 5× rapidly | Final render matches final URL — no stale data |
| T8 | Row with `mass: "unknown"` | `—`, with `title="unknown"` |
| T9 | Jabba (`mass: "1,358"`) | `1,358 kg` — not `NaN`, not `1 kg` |
| T10 | Droid (`hair_color: "n/a"`) | `—` |
| T11 | Return to page 1 | Loads from cache, **no request in the Network tab** |
| T12 | Screen reader / aria-live | Announces "Loading…" then "Page 2 of 9" |

### Caching (requirement 11)

| # | Step | Expected |
|---|---|---|
| C1 | Load page 1, inspect Application → Local Storage | `fib.swapi.people.v1.page.1` with `version`, `savedAt`, `ttlMs`, `payload` |
| C2 | Reload | Served from cache, no network request |
| C3 | Hand-edit the value to `not json` | Reload → refetches, and the bad key is **removed** |
| C4 | Hand-edit `version` to `99` | Reload → refetches, key removed |
| C5 | Hand-edit `savedAt` to `Date.now() - 10*60*1000` | Reload → refetches (expired) |
| C6 | Hand-edit `savedAt` far into the future | Reload → refetches (backwards-clock guard) |
| C7 | "Refresh data" button | Clears prefixed keys and refetches |

C3–C6 are the ones worth demonstrating; they're what "cache validation logic" means.

### Offline & errors (requirements 12–13)

| # | Step | Expected |
|---|---|---|
| E1 | DevTools → Network → Offline, click Next | Modal with the **image**, previous table still visible behind |
| E2 | Restore network | Modal **auto-closes** |
| E3 | Try again from the modal | Page loads |
| E4 | Offline, navigate to an **uncached** page | Inline error + working Retry |
| E5 | Offline, navigate to a **cached** page | Loads from localStorage, no modal |
| E6 | Escape / backdrop click | Modal closes, focus returns to the trigger |
| E7 | Tab repeatedly with modal open | Focus stays trapped inside |
| E8 | Scroll behind an open modal | Locked, no layout shift when it opens |
| E9 | Slow 3G throttling | Times out at 10s into a real error, not an eternal spinner |
| E10 | Point the base URL at a bad host temporarily | Network error path, same as offline |
| E11 | Block the request via DevTools → Network request blocking | Same error path |

### Responsiveness (Responsiveness criterion)

| # | Width | Expected |
|---|---|---|
| R1 | 320 | No horizontal scroll anywhere; card-style rows |
| R2 | 375 | Pagination collapses to `Prev / 4 of 9 / Next`; tap targets ≥ 44px |
| R3 | 768 | Real table columns; sticky header |
| R4 | 1024 | Comfortable; no stretched-thin layout |
| R5 | 1440+ | Content capped and centred |
| R6 | iOS Safari (or emulation) | Focusing an input does **not** zoom the viewport |
| R7 | Mobile landscape, 375×667 rotated | Login card still fully visible (`dvh`) |

### Build hygiene

| # | Check |
|---|---|
| B1 | `npm run lint` → 0 errors, 0 warnings |
| B2 | `npm run build` → succeeds, `tsc -b` clean |
| B3 | No `console.log` left in `src/` |
| B4 | No SCSS `@import` deprecation warnings in the build output |
| B5 | `npm run preview` → the production build works, including routing |
| B6 | Browser console clean on both pages — no React key warnings, no act warnings |
| B7 | Lighthouse a11y pass on both pages (target ≥ 95) |
