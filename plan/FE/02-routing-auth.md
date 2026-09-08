# FE 02 · Routing & the session

Covers: *"Utilize react-router-dom for navigation. Upon successful login, navigate the
user to a new page (e.g. /table)."*

> ## ⚠️ Partly superseded by [../auth.md](../auth.md)
>
> This document was written when the session was a `sessionStorage` boolean. JWT +
> server-side sessions + refresh were added afterwards, so:
>
> | This doc says | Now |
> |---|---|
> | `sessionStorage` holds a fake session flag | An `httpOnly` refresh cookie holds the session; the access token lives in memory |
> | `useState(() => readSession())` — a synchronous lazy read | An **async bootstrap**: `POST /api/auth/refresh` on mount |
> | `isAuthenticated: boolean` | `status: 'bootstrapping' \| 'authenticated' \| 'anonymous'` |
> | `login(username)` is synchronous | `login(username, password)` returns a `Promise` |
> | `ProtectedRoute` redirects when not authenticated | It **renders a waiting state** while bootstrapping, and only redirects once `anonymous` |
>
> **The route/guard structure below is unchanged and still correct** — the routes table,
> `replace` semantics, the declarative-`<Navigate>` reasoning, `useAuth` throwing on a
> missing provider, and the deployment caveat all still apply. Read this for the routing;
> read [../auth.md](../auth.md) for the session mechanics.

## Routes

```ts
// src/routes/paths.ts
export const ROUTES = {
  login: '/',
  table: '/table',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
```

| Path | Screen | Guard |
|---|---|---|
| `/` | `LoginPage` | redirects to `/table` if already authenticated |
| `/table` | `TablePage` | `ProtectedRoute` → redirects to `/` if not |
| `*` | `NotFoundPage` | none |

Login lives at `/` rather than `/login` so the app has no dead root. `ROUTES.login`
is a single constant, so changing that is a one-line edit.

```tsx
// src/routes/AppRoutes.tsx
export const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.login} element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
    <Route path={ROUTES.table} element={<ProtectedRoute><TablePage /></ProtectedRoute>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
```

`BrowserRouter` wraps `AuthProvider` wraps `AppRoutes` in `App.tsx`, in that order —
the provider needs to be inside the router only if it ever calls `useNavigate`; it
doesn't (see below), but keeping it inside costs nothing and prevents a future footgun.

## The session, honestly

There is no backend and the task supplies no credentials, so **valid form == logged in**.
Two things follow, and both go in the repo README so nobody thinks I mistook this for auth:

1. There is nothing to verify a password *against*. Any 4–30 char pair is accepted.
2. The only reason to persist anything is so that **F5 on `/table` doesn't kick you to `/`**.
   Without persistence the guard reads `false` on every reload and the page is unusable.

**Storage choice: `sessionStorage`, not `localStorage`.** A pretend session should die
with the tab. It also keeps the auth key clearly separate from the data-cache keys in
`localStorage` ([05-caching.md](05-caching.md)), so "clear the cache" and "log out" stay
independent operations.

```ts
// src/context/AuthContext/types.ts
export interface AuthUser {
  username: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string) => void;
  logout: () => void;
}
```

```tsx
// src/context/AuthContext/AuthProvider.tsx  (shape, not final code)
const SESSION_KEY = 'fib.session.v1';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  // lazy initialiser: read storage once on mount, not on every render
  const [user, setUser] = useState<AuthUser | null>(() => readSession());

  const login = useCallback((username: string) => {
    const next = { username: username.trim() };
    setUser(next);
    safeSetItem(SESSION_KEY, next);       // try/catch — private mode throws
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    safeRemoveItem(SESSION_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

Notes on the details that matter:

- **Lazy `useState` initialiser** (`() => readSession()`), not a `useEffect` that sets
  state after mount. An effect would render the guard once with `isAuthenticated: false`
  and flash a redirect to `/` before correcting itself.
- **`useMemo` on the context value** is one of the few places memoization is genuinely
  required — without it every provider render hands consumers a new object identity.
- `readSession` validates the parsed shape (`typeof parsed.username === 'string'`) and
  returns `null` on anything unexpected. A hand-edited storage key must not crash the app.
- All storage access goes through `safeSetItem` / `safeGetItem` wrappers that swallow
  `QuotaExceededError` / `SecurityError` — Safari private mode throws on write.

```ts
// src/hooks/useAuth.ts
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
```

Throwing on a missing provider means the return type is non-nullable, so no consumer
needs a `?.` or a null check. That's the whole reason to write the hook instead of
calling `useContext` directly.

## Guards

```tsx
// ProtectedRoute
const { status } = useAuth();
if (status === 'bootstrapping') return <FullPageSpinner />;
if (status === 'anonymous') return <Navigate to={ROUTES.login} replace />;
return <>{children}</>;

// GuestOnlyRoute
const { status } = useAuth();
if (status === 'bootstrapping') return <FullPageSpinner />;
if (status === 'authenticated') return <Navigate to={ROUTES.table} replace />;
return <>{children}</>;
```

**The `bootstrapping` branch is not optional.** The access token lives in memory, so it is
*always* absent at mount — a two-state boolean guard would redirect a signed-in user to
the login page on every page refresh, before the silent-refresh call could resolve. This
is the single bug this design invites; see [../auth.md](../auth.md).

`replace` matters: without it the redirect pushes a history entry and the browser Back
button ping-pongs between guard and target.

Rendering `<Navigate>` (declarative) rather than calling `navigate()` in an effect keeps
the redirect part of the render pass — no intermediate frame of the wrong screen.

## Navigating after login

`LoginForm` calls `login(username)` then `navigate(ROUTES.table, { replace: true })`.
`replace` again, so Back from the table doesn't land on the login form of a session
that's already active (which `GuestOnlyRoute` would then bounce forward — a visible flicker).

Alternative considered and rejected: let `GuestOnlyRoute` do the work implicitly after
`login()` flips the flag. It works, but the navigation intent becomes invisible at the
call site. Explicit `navigate` reads better and is what the task asks to demonstrate.

## Logout

A small "Log out" button in the `/table` page header: `logout()` + `navigate(ROUTES.login, { replace: true })`.
Not in the requirements, but it makes the auth flow demonstrable in both directions and
costs four lines.

## Deployment caveat

`BrowserRouter` needs the host to rewrite unknown paths to `index.html`, or a hard refresh
on `/table` 404s. If the app gets deployed to GitHub Pages for the submission, add a
`404.html` copy of `index.html`, or switch to `HashRouter`. Local `vite dev` and
`vite preview` already handle this — so this only bites at deploy time.
