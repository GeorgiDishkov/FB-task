# Phase 1b + 2 · Outcome

Status: **both complete and verified.**

Phase 2 could not be built or verified without the auth endpoints it bootstraps against,
so Phase 1b (server auth) landed first in the same session. Designed to
[auth.md](auth.md); routing per [FE/02-routing-auth.md](FE/02-routing-auth.md).

---

## Phase 1b — server auth

```
server/src/
├─ auth/
│  ├─ types.ts          AuthUser, AccessTokenClaims, SessionRecord, IssuedTokens, AuthError
│  ├─ tokens.ts         jose sign/verify; TOKEN_EXPIRED vs UNAUTHENTICATED
│  ├─ sessionStore.ts   Map + SHA-256 hashes, rotation, constant-time compare
│  └─ authService.ts    login / refresh (with reuse detection) / logout
├─ middleware/
│  └─ requireAuth.ts    requireAuth gate + withAuth(handler) for claims
├─ routes/
│  ├─ authRoutes.ts     POST login/refresh/logout, GET me
│  └─ schemas.ts        + loginSchema
├─ config.ts            + JWT_SECRET, parseDuration, TTLs, cookie name/path
└─ middleware/errorHandler.ts   + AuthError → response mapping
```

### Verified end to end with curl

| # | Case | Result |
|---|---|---|
| 1 | `/api/people` with no token | 401 `UNAUTHENTICATED` |
| 2 | `/api/people` with a valid token | 200, 10 records, `count: 87` |
| 3 | Login with a 3-character password | 400 `INVALID_CREDENTIALS_FORMAT` — **the server validates, not just the form** |
| 4 | Valid login | 3-part JWT, `expiresIn: 900`, **refresh token absent from the body** |
| 5 | Refresh cookie flags | `HttpOnly` present in the cookie jar |
| 6 | Tampered JWT (last char changed) | 401 `UNAUTHENTICATED` — signature check |
| 7 | `GET /auth/me` | `{"user":{"username":"georgi"}}` |
| 8 | Refresh | new access token, **secret rotated, session id preserved** |
| 9 | **Replay the old refresh token** | 401 `SESSION_REVOKED` |
| 10 | The freshly issued token, after that replay | 401 `SESSION_EXPIRED` — **the whole session died, which is the point** |
| 11 | Logout | 204, cookie cleared, session gone |
| 12 | Refresh after logout / with no cookie | 401 `NO_SESSION` |
| 13 | `JWT_SECRET` unset | **refuses to boot** with an actionable message |
| 14 | `ACCESS_TOKEN_TTL=1s` | 200 immediately, `TOKEN_EXPIRED` two seconds later |

Case 10 is the one worth demonstrating: replaying a rotated token doesn't merely fail, it
revokes the session, so the legitimate token dies too. That's the theft-response
behaviour, and it's why refresh tokens are opaque and stored rather than self-contained.

Case 14 confirms `TOKEN_EXPIRED` is distinct from `UNAUTHENTICATED`, which is what the
client's refresh-and-retry will depend on in Phase 4.

### Two design points that survived contact

- **`AuthError` is mapped in the central error handler**, not in per-handler try/catch.
  A `catch` containing `if (error instanceof AuthError)` would be nesting depth 2 and
  breach AGENT.md §3. Express 5 forwards rejected async handlers automatically, so every
  handler stayed flat.
- **`withAuth(handler)` passes claims as an argument** rather than augmenting Express's
  `Request` via a global `declare module`. Explicit data flow, no casts, and no ambient
  type declaration to explain.

### One compiler correction

`AuthError` originally used constructor parameter properties (`readonly code: …` in the
signature). `erasableSyntaxOnly` rejects those, because they emit runtime assignments.
Fields are now declared explicitly and assigned in the body.

---

## Phase 2 — client routing and session

```
client/src/
├─ App.tsx                       BrowserRouter → AuthProvider → AppRoutes
├─ vite-env.d.ts                 typed VITE_SERVER_BASE_URL / VITE_API_BASE_URL
├─ routes/
│  ├─ paths.ts                   ROUTES = { login: '/', table: '/table' }
│  ├─ AppRoutes.tsx
│  ├─ ProtectedRoute/            + ProtectedRoute.test.tsx
│  └─ GuestOnlyRoute/
├─ context/AuthContext/          AuthContext, AuthProvider (async bootstrap), types
├─ hooks/useAuth.ts              throws on a missing provider
├─ services/
│  ├─ constants.ts               SERVER_BASE_URL + DATA_BASE_URL, deliberately separate
│  └─ authService.ts             in-memory token, shared in-flight refresh
├─ components/ui/FullPageSpinner/
├─ pages/LoginPage/              stub form + elements/LoginField
├─ pages/TablePage/              stub, proves the guard and logout
└─ types/                        auth.ts, common.ts, index.ts
```

### Verified in the browser

| # | Case | Result |
|---|---|---|
| 1 | Fresh load, no session | bootstrap `refresh` → 401 → login page. **Expected 401, appears in the console** |
| 2 | Sign in | one `POST /auth/login` → 200, navigates to `/table`, shows the username |
| 3 | One button click | **exactly one** login request — no double-submit |
| 4 | **Hard reload on `/table`** | stays on `/table`, still signed in, **exactly one** `POST /auth/refresh` → 200 |
| 5 | `localStorage` / `sessionStorage` after login | **both empty** — no token in web storage |
| 6 | `document.cookie` | empty — the refresh cookie is `httpOnly` and on the API origin |
| 7 | Log out | back to `/`, heading "Sign in" |
| 8 | Direct `/table` while signed out | redirected to `/` |
| 9 | Visit `/` while signed in | redirected to `/table` (`GuestOnlyRoute`) |
| 10 | Unknown route | "Page not found" |
| 11 | 320 px, login page | no horizontal overflow; input `font-size: 16px`; button `min-height: 44px`; card padding 24px |
| 12 | 320 px, table page | no horizontal overflow, header wraps |

Case 4 is the phase's headline: the access token is in memory, so a reload always loses
it, and the session is restored purely from the `httpOnly` cookie.

### Honest gaps in the verification

- **Enter-to-submit was not verified through a real key event.** The harness's synthetic
  `Return` did not trigger the browser's implicit form submission, and no request fired.
  The form's submit path *was* verified via `form.requestSubmit()` — the exact code path
  implicit submission uses — which logged in successfully. So the wiring is correct and
  only the key-event step is unconfirmed here; it stays on the manual QA list (L8) for
  Phase 3's real form.
- **The `bootstrapping` spinner was never observed on screen** — localhost resolves the
  refresh too fast. Rather than fake latency for a screenshot, the behaviour is locked in
  by a unit test (below), which is the more durable guard.
- **`form_input` produced one spurious 400** in the network log. Setting a DOM value
  directly doesn't fire React's `onChange`, so one field stayed empty in state and the
  server rejected it. A harness artifact, not an app bug — and it incidentally proved
  server-side validation rejects a bad body sent by the real client.

### Tests added

`ProtectedRoute.test.tsx` — 3 cases, all passing (5 tests total in the suite):

- authenticated → renders the protected content
- anonymous → redirects to the login page
- **bootstrapping → renders the waiting state and redirects nowhere**

That third case is the regression guard for this phase's main hazard. If the
`bootstrapping` branch ever collapses into the anonymous one, every signed-in user gets
bounced to the login page on page refresh — and it would be easy to "simplify" into
exactly that.

### Two lint findings, both legitimate

1. **`no-misused-promises`** on `onSubmit={handleSubmit}` / `onClick={handleLogout}`.
   An async function handed straight to a DOM attribute turns a rejection into an
   unhandled one. Fixed by wrapping the call site: `onSubmit={(event) => { void handleSubmit(event); }}`.
2. **`max-lines-per-function`** — the stub login page hit 63 lines. Fixed by extracting
   the two duplicated label/input blocks into `pages/LoginPage/elements/LoginField/`,
   which is what AGENT.md §5 is for. The duplication was real, so this was the right
   change regardless of the line count; Phase 3 replaces it with the shared `Input`
   primitive.

No rule was disabled or relaxed (AGENT.md §8).

---

## Deviations from the plan

- **Two base URLs, not one.** `services/constants.ts` exports `SERVER_BASE_URL` (ours,
  always used for auth) and `DATA_BASE_URL` (switchable, defaults to SWAPI). The plan
  implied a single `VITE_API_BASE_URL`; auth forced the split, and it is what keeps the
  bearer token from ever being sent to a third-party origin.
- **`AuthProvider` uses `<AuthContext value={…}>`**, React 19's direct-provider form,
  rather than `<AuthContext.Provider>`.
- **`.env` files for the client were not created.** Both constants have working defaults,
  so nothing is needed until the data source is switched in Phase 4.

## Verified

- [x] `npm run build` — client bundle 236 kB / 76 kB gzipped, server type-check clean
- [x] `npm run lint` — 0 errors, 0 warnings across both workspaces at `--max-warnings 0`
- [x] `npm test` — 5 passing in 2 files
- [x] `npx prettier --check .` — clean
- [x] 14 server auth cases via curl, 12 client cases in the browser

## Not done

- Nothing is pushed; there is still no remote.
- The people table, caching and offline handling are phases 4–6. `TablePage` is a stub.
- The real login form (Joi, `Input`/`Button` primitives, touched-field error timing,
  a11y wiring) is Phase 3 — the current form is deliberately plain and labelled as a stub
  on screen.
