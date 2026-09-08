# Phase 6 · Outcome

Status: **complete and verified.** Requirements 12 and 13 are done: error handling for
failed requests, and an offline modal containing an image, triggered when a fetch fails.

That completes **all 13 requirements**. Phase 7 is responsive/a11y polish, Phase 8 is
delivery.

Built to [FE/06-offline-and-errors.md](FE/06-offline-and-errors.md).

## What landed

```
client/src/
├─ lib/connectivity.ts            module-scope pub/sub bridging fetch to React
├─ hooks/
│  ├─ useOnlineStatus.ts          navigator.onLine events + reported fetch failures
│  └─ useLockBodyScroll.ts        scroll lock with scrollbar-width compensation
├─ assets/offline.svg             the required image — local, 1.2 kB, inlined by Vite
├─ components/
│  ├─ ui/Modal/                   portal, focus trap, focus restore, Escape, backdrop
│  ├─ OfflineModal/               + OfflineModal.test.tsx (8 cases)
│  └─ ErrorBoundary/              render-error fallback
├─ services/http.ts               + reports failure/success to the connectivity bridge
└─ App.tsx                        ErrorBoundary → Router → AuthProvider → routes + modal
```

`ErrorState` and retry already shipped in Phase 4; this phase added the connectivity
detection and the modal around them.

## Both offline signals, verified independently

This is the heart of the requirement, and neither signal is sufficient alone.

**Path 1 — the browser reports offline** (what Chrome DevTools › Network › Offline does):

| Check | Result |
|---|---|
| Modal appears | ✅ |
| `role="dialog"`, `aria-modal="true"` | ✅ |
| `aria-labelledby` resolves | ✅ to "You're offline" |
| Image present and actually rendered | ✅ `naturalWidth > 0` |
| Image is a **local inlined data URI** | ✅ — needs no network at all |
| Image is decorative | ✅ `alt=""`, `aria-hidden="true"` |
| Portalled outside `#root` | ✅ |
| Body scroll locked | ✅ `overflow: hidden` |
| Focus moved into the dialog | ✅ |
| **Cached table still readable behind it** | ✅ 10 rows |

**Path 2 — a rejected fetch while `navigator.onLine` is still `true`.** Stubbed `fetch`
to reject with `TypeError: Failed to fetch`, exactly as a browser reports a request that
never left, and left `navigator.onLine` reporting `true`:

| Check | Result |
|---|---|
| `navigator.onLine` | `true` — the browser insists it is online |
| Modal appeared anyway | ✅ |
| Inline `ErrorState` alongside it | ✅ "You appear to be offline." with a working "Try again" |

Path 2 is the one that catches a captive portal, a blocked request, or an unreachable
server — none of which fire an `offline` event. Path 1 is the one that fires before any
request is even attempted.

## The payoff: cache + offline together

With **no network at all** (rejected fetch *and* the browser reporting offline),
navigating away from page 1 and back:

- the table rendered **10 rows** from localStorage,
- the badge read **"Cached · just now"**,
- and **no inline error appeared** — because nothing failed.

The modal notifies; the content stays usable behind it. That is the two "Features"
requirements paying each other off, and it is worth demonstrating in the README.

## Modal behaviour, all verified

| Check | Result |
|---|---|
| Tab from the last control wraps to the first | ✅ |
| Shift+Tab from the first wraps to the last | ✅ |
| Escape closes | ✅ |
| Body overflow restored on close | ✅ |
| Dismiss hides it | ✅ |
| **Reappears on the next drop after being dismissed** | ✅ — dismissal does not permanently silence it |
| **Auto-closes on reconnect with no user action** | ✅ |
| Fits at 375 px with no horizontal overflow | ✅ |

## Design decisions

- **The image is local, and that is not a style preference.** A remote illustration
  cannot load in the one state this modal exists for — it would render as a broken-image
  icon precisely when needed. The SVG is 1.2 kB, under Vite's inline threshold, so it
  ships inside the JS bundle as a data URI. Confirmed at runtime: `currentSrc` starts
  with `data:` and `naturalWidth > 0`.
- **`lib/connectivity.ts` is a module-scope pub/sub, not a second React context.**
  `http.ts` is not a component and cannot call a hook. Nine lines of `Set<listener>`
  beats a provider, and `useOnlineStatus` subscribes in an effect.
- **Successful responses report reachability too.** Without that, suspicion raised by a
  failed fetch could only be cleared by an `online` event — which never fires when
  `navigator.onLine` was `true` the whole time. Any answer at all, whatever its status
  code, means the network is reachable.
- **Mounted at app level, not inside `TablePage`.** The plan suggested starting local and
  promoting only if a second consumer appeared; the login form makes a request too, so
  the second consumer already exists. App level from the start.
- **Dismissible, not blocking.** Cached pages remain perfectly usable offline, so
  trapping the user behind an overlay would hide content that still works. Dismissal
  resets on the next connectivity change, so it cannot be permanently silenced.
- **`aria-live="polite"` on field errors, `role="alert"` on request failures.** Set in
  Phase 3; the modal keeps that split — a failed request is the assertive one.

## Deviations from the plan

| Plan | Built | Why |
|---|---|---|
| Modal offers "Try again" + "Dismiss" | **"Check again" + "Dismiss"** | An app-level modal cannot know what to refetch. "Check again" clears the suspicion flag so connectivity is genuinely re-evaluated; the inline `ErrorState` owns the real retry, because it is the thing that knows what to reload. A "Try again" that did nothing would be a misleading control. |
| Start the modal inside `TablePage`, promote later | App level immediately | Two consumers already exist (login and table) |
| `anySignal` helper combining abort signals | Native `AbortSignal.any` | Already used in Phase 4; no helper needed |

## Two findings

1. **The lint caught the exact anti-pattern AGENT.md §3 exists for.** My first version of
   the failure reporting put `if (isOfflineError(appError))` inside a `catch` block —
   nesting depth two. Extracted to `toReportedError()`, which reads better anyway. Same
   shape as the server-side `AuthError` mapping in Phase 1b.
2. **`noImplicitOverride` required `override state`** on the `ErrorBoundary` class field.
   Worth noting because `state` initialisation looks like a declaration rather than an
   override.

## One incident worth recording honestly

Mid-phase the dev server served a blank page with
`SyntaxError: does not provide an export named 'App'` and a React "rendered more hooks
than during the previous render" error. **This was a stale Vite HMR module graph**, caused
by rewriting `App.tsx` and adding a hook to a live module — not a code defect. The
production build succeeded throughout, and restarting the dev server cleared it. Recorded
because the first-glance conclusion ("the ErrorBoundary is broken" / "hooks are
misordered") was wrong, and the stale `?t=` timestamps in the console were the tell.

## Tests: 76 passing (13 new)

`OfflineModal.test.tsx` (8): nothing while online; appears on the browser `offline`
event; **contains a decorative image**; appears on a reported request failure *while
`navigator.onLine` is `true`*; closes when a later request succeeds; dismissible;
reappears on the next drop after dismissal; auto-closes on reconnect.

`format.test.ts` (+5): `describeAge` for seconds, minutes and hours, plus a future
timestamp clamping to "just now" — the same backwards-clock concern as the cache.

## Verified

- [x] `npm run build` — clean; bundle 452 kB / 139 kB gzipped
- [x] `npm run lint` — 0 errors, 0 warnings at `--max-warnings 0`
- [x] `npm test` — 76 passing in 8 files
- [x] `npx prettier --check .` — clean
