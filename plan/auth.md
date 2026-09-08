# Auth · JWT, sessions, and token refresh

Design for the requested authentication layer. Supersedes the `sessionStorage` boolean in
[FE/02-routing-auth.md](FE/02-routing-auth.md) and the "no login endpoint" decision in
[BE/README.md](BE/README.md) — see the reversals register in [AUDIT.md](AUDIT.md).

Coding rules: [../AGENT.md](../AGENT.md).

---

## What this does and does not claim

> **Updated:** an earlier version of this document said there was no user store and that
> any valid-format pair was accepted. That is no longer true — a seeded account was added
> in the final phase. See [phase-8-outcome.md](phase-8-outcome.md).

**Credentials are verified.** A single account is seeded into `server/data/users.json`:

| Username | Password |
|---|---|
| `admin` | `Password1!` |

The file stores a salted **bcrypt** hash (cost 12), never the plaintext. Login looks the
user up case-insensitively and verifies the password against that hash.

**Registration is live at `/register`.** New accounts are appended to the same store and
persisted, so they survive a restart. That made the user store the one thing in this
project that is *written* to — see the note on persistence below.

Two details make it behave like a real login rather than a demo shortcut:

- **A wrong password and an unknown username return the identical error** (`401`,
  `INVALID_CREDENTIALS`, same message). Distinguishing them would let an attacker
  enumerate valid usernames.
- **The missing-user branch burns the same KDF work** — a `bcrypt.compare` against a
  throwaway hash. Otherwise "unknown user" returns in microseconds while "wrong password"
  pays the full bcrypt cost — a timing oracle that gives the answer away regardless of the
  response body.
- **A taken username returns 409 `USERNAME_TAKEN`,** and uniqueness is checked
  case-insensitively to match how login looks users up. Otherwise "Admin" could be
  registered alongside "admin" and only one of them would ever be reachable.

### Persistence, and what it cost

Adding registration broke the "everything in memory, nothing written" design, and that
was the honest consequence rather than something to work around: the moment users can
create an account, "in memory with no persistence" stops being a design decision and
becomes data loss. So the user store is no longer frozen, and `insertUser` writes
`users.json` via **write-to-temp-then-rename**, which is atomic on one filesystem — a
crash mid-write cannot leave a truncated store behind.

There is no file locking, so genuinely concurrent registrations could interleave. Fine
for a single-process demo; not a pattern to carry into production.

**What is still not production-like:** no password reset, no account deletion, and
sessions that vanish on server restart. Those are scope decisions, not oversights, and
the repo README lists them.

---

## Token model

| | Access token | Refresh token |
|---|---|---|
| Format | **JWT**, HS256 | **Opaque** — 32 random bytes, base64url |
| Lifetime | 15 minutes (`ACCESS_TOKEN_TTL`) | 1 day (`REFRESH_TOKEN_TTL`) |
| Client storage | **memory only** (React context) | **`httpOnly` cookie** |
| Sent as | `Authorization: Bearer <jwt>` | cookie, automatically |
| Revocable | no (stateless by design) | **yes** — that's the point |
| Server keeps | nothing | a SHA-256 hash, in the session store |

### Why the access token is a JWT and the refresh token is not

A JWT is verified by signature alone, with no lookup — which is exactly why it cannot be
revoked before it expires. That is an acceptable trade for a 15-minute credential, and it
is the reason the access token TTL is short.

The refresh token is the long-lived credential, so revocability matters more than
statelessness. Making it an opaque random string checked against the session store means
logout actually invalidates it server-side. A JWT refresh token would need a denylist to
achieve the same thing — the same lookup, with extra steps and a bigger cookie.

### Why the access token lives in memory, not `localStorage`

`localStorage` is readable by any script on the origin, so an XSS there yields a usable
bearer credential. Holding it in a React context variable means it dies with the tab and
is never persisted.

The cost is that a page refresh loses it — which is precisely what the refresh endpoint
exists to solve, and why the `httpOnly` cookie carries the long-lived half. The cookie is
unreadable from JavaScript, so an XSS cannot exfiltrate it either; it can only ride along
with requests to our own origin.

### Why refresh tokens are stored hashed

The session store holds `sha256(refreshToken)`, never the token. If the store were ever
dumped — a log line, a crash report, a `read_db`-style inspection — the contents are not
usable credentials. It costs one `node:crypto` call on each refresh.

---

## Server

### New dependencies

| Package | Why |
|---|---|
| **`jose`** | JWT sign/verify. ESM-native, zero-dependency, well-typed. Chosen over `jsonwebtoken`, which is CJS and needs `@types` — the server is `"type": "module"` |
| **`cookie-parser`** | Express 5 has no built-in cookie parsing |
| `@types/cookie-parser` | dev |

### Files

```
server/
├─ .env                          JWT_SECRET (gitignored)
├─ .env.example                  documents the contract, committed
└─ src/
   ├─ config.ts                  + JWT_SECRET, token TTLs, cookie name
   ├─ auth/
   │  ├─ tokens.ts               signAccessToken / verifyAccessToken / newRefreshToken
   │  ├─ sessionStore.ts         in-memory Map, hashed refresh tokens
   │  ├─ authService.ts          login / refresh / logout — the actual logic
   │  └─ types.ts                AuthUser, SessionRecord, TokenPair
   ├─ middleware/
   │  └─ requireAuth.ts          Bearer → req.auth, or 401
   └─ routes/
      ├─ authRoutes.ts           login / refresh / logout / me
      └─ schemas.ts              + loginSchema
```

### The secret, from `.env`

```ini
# server/.env.example
JWT_SECRET=replace-me-with-at-least-32-random-characters
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=1d
```

```ts
// config.ts
const readSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (secret === undefined || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to at least 32 characters. Copy server/.env.example to server/.env.',
    );
  }

  return secret;
};

export const JWT_SECRET = readSecret();
```

**The server refuses to boot without it**, rather than falling back to a default. A
hardcoded development secret is the single most common way a real secret ends up
committed later — there is no fallback to forget to remove.

`.env` is already covered by the root `.gitignore`; `.env.example` is committed so the
contract is discoverable. Node 22 loads `.env` natively via `--env-file`, so no `dotenv`
dependency: `tsx watch --env-file=.env src/index.ts`.

> ⚠️ Setting `ACCESS_TOKEN_TTL=30s` makes the refresh cycle observable in DevTools within
> a normal review session. Same reasoning as the 5-minute cache TTL — a feature nobody can
> watch happen is a feature nobody believes.

### Session store

```ts
export interface SessionRecord {
  sessionId: string;
  username: string;
  refreshTokenHash: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number;
}

const sessions = new Map<string, SessionRecord>();
```

Same reasoning as the people store: the data is small, ephemeral, and never redeployed,
so a `Map` is the whole implementation. Sessions vanish on restart — correct for a demo,
and stated in the README so nobody reports it as a bug.

Expired records are dropped lazily on read (a `setInterval` sweep would be a background
timer to manage for no benefit at this scale).

### Endpoints

| Method | Path | Body / input | Returns |
|---|---|---|---|
| `POST` | `/api/auth/login` | `{ username, password }` | `{ user, accessToken, expiresIn }` + `Set-Cookie` refresh |
| `POST` | `/api/auth/refresh` | refresh cookie | `{ user, accessToken, expiresIn }` + **rotated** `Set-Cookie` |
| `POST` | `/api/auth/logout` | refresh cookie | `204`, cookie cleared, session deleted |
| `GET` | `/api/auth/me` | `Bearer` | `{ user }` |

`GET /api/people` gains `requireAuth`.

All failures use the existing `ApiErrorBody` envelope, so the client has one shape to
parse:

| Case | Status | Code |
|---|---|---|
| Login body fails the Joi schema | 400 | `INVALID_CREDENTIALS_FORMAT` |
| No refresh cookie present | 401 | `NO_SESSION` |
| Refresh token unknown or expired | 401 | `SESSION_EXPIRED` |
| Refresh token replayed after rotation | 401 | `SESSION_REVOKED` |
| Missing or malformed `Authorization` | 401 | `UNAUTHENTICATED` |
| Access token expired | 401 | `TOKEN_EXPIRED` |

`TOKEN_EXPIRED` is deliberately distinct from `UNAUTHENTICATED`: the client retries the
first after a refresh, and gives up on the second. Collapsing them into one code would
either cause pointless refresh attempts or break silent re-auth.

### Login validation — the same Joi rules as the form

`loginSchema` on the server mirrors the client's field rules, because a client-side-only
check is a UX affordance, not a validation. Note the asymmetry carries over: `.trim()` on
username, none on password ([FE/03-login-form.md](FE/03-login-form.md)).

And the trap from Phase 1 applies again — **narrow on `error` before reading `value`**, or
Joi's `ValidationResult` union collapses `value` to `any`:

```ts
const result = loginSchema.validate(request.body, { abortEarly: false, convert: true });
if (result.error) { /* 400 */ return; }
const { username } = result.value;
```

### Cookie flags

```ts
response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
});
```

- `httpOnly` — unreadable from JavaScript.
- `sameSite: 'lax'` — `localhost:5173` → `localhost:3001` is *same-site* (a different port
  does not change the site), so `lax` works and `none` is not needed. `none` would
  require `secure: true`, which fails on plain-HTTP localhost.
- `secure` off in dev only. Hardcoding `false` would be the bug.
- `path: '/api/auth'` — the cookie is only sent to the endpoints that need it, so it never
  rides along with data requests.

### CORS must allow credentials

```ts
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
```

`credentials: true` is incompatible with `origin: '*'` — the browser rejects it. We
already pin the origin explicitly, so this is a one-word change rather than a redesign.
Worth noting as the reason that decision was already correct.

---

## Client

### `AuthContext` becomes asynchronous

This is the real cost of the change, and the part that must not be got wrong.

```ts
export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

The access token is **not** exposed on the context value. It lives in a module-scoped
variable inside the auth service, reachable only by the fetch layer that needs to attach
it. Putting it on the context would invite components to read it and would re-render every
consumer on each refresh.

On mount, the provider attempts a **silent re-auth**: `POST /api/auth/refresh`. If the
`httpOnly` cookie is still valid the user is restored without typing anything; otherwise
the status becomes `anonymous`.

```
mount → status: 'bootstrapping'
      → POST /api/auth/refresh
         ├─ 200 → store access token in memory, status: 'authenticated'
         └─ 401 → status: 'anonymous'
```

### `ProtectedRoute` must wait, not redirect

```tsx
const { status } = useAuth();

if (status === 'bootstrapping') return <FullPageSpinner />;
if (status === 'anonymous') return <Navigate to={ROUTES.login} replace />;
return <>{children}</>;
```

**Redirecting while bootstrapping would bounce a logged-in user to the login page on every
page refresh** — the token is in memory and therefore always absent at mount, so the guard
would fire before the refresh call resolves. This is *the* bug this design invites, and
the reason `status` is a three-state union rather than an `isAuthenticated` boolean. A
boolean cannot express "don't know yet", and would make the wrong behaviour the natural
one to write.

`GuestOnlyRoute` waits on `bootstrapping` for the same reason, otherwise a refresh on `/`
briefly shows the login form to someone already signed in.

### `http.ts` — attach, refresh once, retry once

```
requestJson(url)
  │
  ├─ same-origin as our API? → attach Authorization: Bearer <accessToken>
  │
  ├─ 200 → done
  │
  └─ 401 with code TOKEN_EXPIRED, and not already retried
        └─ await refreshAccessToken()   ← shared in-flight promise
              ├─ ok    → retry the original request exactly once
              └─ fails → clear auth state, let the caller see the 401
```

Three details that matter:

1. **One shared in-flight refresh promise.** The table page can easily fire concurrent
   requests; three parallel 401s would start three refreshes, and rotation would
   invalidate two of them — logging the user out during a *successful* refresh. So
   `refreshAccessToken()` memoises its promise while in flight and every caller awaits the
   same one. This is a real bug, not a hypothetical.
2. **Retry exactly once.** A retry counter, not recursion, so an endpoint that returns 401
   for a non-token reason cannot loop.
3. **The token is attached only to our own API.** In SWAPI mode the request goes to a
   public third-party origin, and sending a bearer token there would leak a credential to
   someone else's server. The check is on the request's base URL, not a flag.

### Files added

```
client/src/
├─ context/AuthContext/          + async bootstrap, AuthStatus
├─ hooks/useAuth.ts              unchanged shape, new status field
├─ services/
│  ├─ authService.ts             login / refresh / logout / me + the in-memory token
│  └─ http.ts                    + attach, refresh-once, retry-once
└─ components/ui/FullPageSpinner/  bootstrapping state
```

---

## Consequence of keeping SWAPI as the default source

You confirmed SWAPI stays the default. So:

- **Auth always runs against our backend** — login, refresh and logout are ours regardless
  of where data comes from.
- **In SWAPI mode the data request carries no token**, because SWAPI is a public API and
  attaching one would leak it.
- Therefore `requireAuth` on our `/api/people` is only exercised in backend mode
  (`VITE_API_BASE_URL=http://localhost:3001/api`).

That is an honest consequence of requirement 6 naming the SWAPI URL literally, not an
oversight, and the README will say so. If you'd rather the protected endpoint be the one
that's demonstrated, flipping the default is one line — but it trades literal compliance
with requirement 6 for it.

---

## Phase impact

| Phase | Change |
|---|---|
| **1b** (new) | Server auth: `jose`, session store, four endpoints, `requireAuth`, `.env`. ~1.5 h |
| **2** | `AuthContext` gains the async bootstrap; guards gain a waiting state; `FullPageSpinner`. Was 0.75 h, now ~1.25 h |
| **3** | Login submit becomes async: `Promise`, in-flight state, server-error display. This finally justifies the `Button` `loading` prop that had no caller |
| **4** | `http.ts` gains attach / refresh-once / retry-once and the shared in-flight promise. ~+0.5 h |
| **9** | New QA cases: refresh survives a page reload, logout invalidates the session, an expired access token refreshes silently, a replayed refresh token revokes the session, concurrent 401s trigger exactly one refresh |

Roughly **+3 h**, taking the total from ~12 h to ~15 h. Still inside two days, but the
slack is largely gone — worth knowing before Phase 2 starts.

## Testing additions

Unit (pure, fast — `server`):

- `tokens.ts`: a signed token verifies; a tampered payload fails; an expired token fails.
- `sessionStore.ts`: create → find; rotation replaces the hash; a replayed old hash is
  rejected; an expired record is not returned.

Manual (in [FE/09-testing-qa.md](FE/09-testing-qa.md)):

- Log in, hard-refresh `/table` → still signed in, no flash of the login form.
- Log out → `/table` redirects; the refresh cookie is gone.
- Set `ACCESS_TOKEN_TTL=30s`, wait, change page → one `refresh` call, then the data
  request succeeds, with no visible interruption.
- Restart the server while signed in → next refresh gives `SESSION_EXPIRED`, and the
  client returns to the login page cleanly rather than hanging.
