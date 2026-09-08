# FE 06 · Error handling & the offline modal

Covers:
- *"Error Handling: Implement error handling for failed API requests."*
- *"notify the user if his connection is down displaying a modal with an image inside
  (should be simulated/tested via the dev-tools network options when the user's browser
  makes a fetch request)"*

The parenthetical is a **test instruction**, and it dictates the implementation: the
modal must appear when DevTools is set to Offline **and a fetch is attempted**. So
listening to `navigator.onLine` alone is not sufficient — and neither is catching the
fetch alone. Both paths are needed.

## Why both signals

| Signal | Fires when | Fails to fire when |
|---|---|---|
| `window` `offline` event / `navigator.onLine` | OS/browser loses the network; **Chrome's DevTools "Offline" preset does flip this** | DevTools *throttling* profiles other than Offline; captive portals; server unreachable but LAN up — `onLine` stays `true` |
| `fetch` rejects with `TypeError: Failed to fetch` | the request never left the machine — offline, DNS failure, CORS, blocked | nothing; but it only tells you *at request time* |

`navigator.onLine === true` only means "there is *a* network interface", not "the
internet is reachable". It's a reliable **negative** (false ⇒ definitely offline) and an
unreliable **positive**. So:

- `onLine === false` → offline, immediately, no request needed.
- a `fetch` that rejects with a `TypeError` → treat as offline **even if `onLine` is true**.

Union of the two = the modal appears under every scenario the reviewer will try.

## `lib/errors.ts` — one taxonomy

```ts
export type AppErrorKind = 'network' | 'timeout' | 'http' | 'parse' | 'aborted' | 'unknown';

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) { super(message); this.name = 'AppError'; }
}

export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && error.name === 'AbortError')
    return new AppError('aborted', 'Request cancelled.', undefined, error);
  if (error instanceof TypeError)          // ← the offline / unreachable case
    return new AppError('network', 'Could not reach the server.', undefined, error);
  if (error instanceof SyntaxError)        // res.json() on a non-JSON body
    return new AppError('parse', 'Unexpected response from the server.', undefined, error);
  return new AppError('unknown', 'Something went wrong.', undefined, error);
};

export const isOfflineError = (error: AppError) => error.kind === 'network' || error.kind === 'timeout';
```

Discriminating on `kind` — rather than string-matching `error.message` — is what lets
each surface choose its own presentation without re-deriving the cause.

> Timeout is folded into "looks like connectivity" for the modal, but keeps its own kind
> so the inline error can say "took too long" rather than "no connection". A DevTools
> slow-3G profile produces a timeout, not a `TypeError`, and a spinner that never
> resolves is the worst of the possible outcomes.

## Per-kind user-facing copy

| kind | Inline `ErrorState` | Offline modal? |
|---|---|---|
| `network` | "You appear to be offline." | **yes** |
| `timeout` | "The request took too long." | yes |
| `http` 404 | "We couldn't find that page of results." (→ also clamp the page) | no |
| `http` 429 | "Too many requests — try again shortly." | no |
| `http` 5xx | "The Star Wars API is having trouble. Try again." | no |
| `parse` | "We got an unexpected response." | no |
| `unknown` | "Something went wrong." | no |
| `aborted` | *nothing rendered* — we caused it | no |

Distinguishing 4xx from 5xx matters: "try again" is useless advice for a 404 and correct
advice for a 503.

## `ErrorState` component

Rendered inline where the table would be (or above a preserved stale table):

```
  ⚠  You appear to be offline.
     Check your connection and try again.
     [ Try again ]              ← calls usePeople().retry()
```

- `role="alert"` so it's announced.
- The retry button reuses the `Button` primitive with `loading` while the retry is in flight.
- If `data` from a previous successful page is still in state, the table **stays rendered
  below the banner** rather than vanishing. Losing content you already had is worse than
  seeing it slightly stale.

## `hooks/useOnlineStatus.ts`

```ts
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  // set by the fetch layer when a request fails with kind 'network'
  const [suspectedOffline, setSuspectedOffline] = useState(false);

  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setSuspectedOffline(false); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline: isOnline && !suspectedOffline, reportNetworkFailure, clearSuspicion };
};
```

- Lazy initialiser reads `navigator.onLine` **once**, synchronously — an effect-based read
  would render one frame claiming "online" before correcting.
- Listeners are added once (`[]` deps) and removed in cleanup. This is the canonical
  "`useEffect` for an external subscription" case, and the only one in the app besides fetch.
- `online` clears `suspectedOffline` too, so recovery is automatic and the modal
  self-closes without user action.

The `suspectedOffline` bridge is what connects a failed fetch to the modal. Cleanest
wiring: promote this into a tiny `ConnectivityContext` (provider in `App`) with
`{ isOnline, reportNetworkFailure }`, so `usePeople`'s catch block can call
`reportNetworkFailure()` and the globally-mounted modal reacts. That's a second context
holding one boolean and one callback — still far less machinery than a store, and it
keeps `OfflineModal` mounted at app level rather than inside the table page.

> If that feels like one context too many for a first pass, the fallback is to render
> `OfflineModal` inside `TablePage` and drive it from
> `!isOnline || (status === 'error' && isOfflineError(error))`. Same behaviour, less
> plumbing, slightly less reusable. **Decision: start with the local version in Phase 5;
> promote to context only if a second consumer appears.** Don't build the abstraction first.

## `Modal` primitive (`components/ui/Modal`)

Reused by `OfflineModal` and available for anything later.

- Rendered through `createPortal` into `document.body` — escapes any `overflow: hidden`
  or `transform` ancestor that would otherwise clip a fixed-position overlay.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → the title id,
  `aria-describedby` → the body id.
- **Focus management:** store `document.activeElement` on open, move focus to the dialog,
  restore on close. Without restore, closing the modal dumps focus at `<body>` and
  keyboard users lose their place.
- **Focus trap:** `Tab` / `Shift+Tab` cycle within the dialog. A short hand-rolled trap
  (query focusable children, wrap at the ends) — no `focus-trap-react` dependency for this.
- `Escape` closes (when dismissible). Click on the backdrop closes; click inside does not
  (guard with `event.target === event.currentTarget`, not `stopPropagation` on the panel).
- `useLockBodyScroll` toggles `overflow: hidden` on `document.body` while open, and
  compensates for scrollbar width so the page behind doesn't shift.
- Mount/unmount transition: fade backdrop + small scale-up on the panel, wrapped in
  `@media (prefers-reduced-motion: reduce)` to disable.

## `OfflineModal`

Content — the image is a hard requirement, so it's the centrepiece:

```
┌───────────────────────────────┐
│      [ offline.svg ]          │  ← required image
│                               │
│   You're offline              │  <h2 id=...>
│   We can't reach the Star     │
│   Wars API right now. Your    │
│   last loaded results are     │
│   still shown below.          │
│                               │
│   [ Try again ]  [ Dismiss ]  │
└───────────────────────────────┘
```

**The image:** a local SVG in `src/assets/offline.svg` (a disconnected-plug /
no-signal illustration), imported as an asset. Reasons it's an SVG and local:

- an image loaded from a **remote URL cannot render while offline** — which is the exact
  state the modal exists for. A remote illustration would be a broken-image icon in the
  one scenario that matters. This is the trap in this requirement.
- SVG is inlined by Vite below the asset-inline threshold, so it's in the JS bundle and
  needs no network at all;
- it scales crisply and can inherit theme colours.

Given as `<img src={offlineSvg} alt="" aria-hidden="true" width={160} height={160} />` —
decorative, because the heading already carries the message, and a redundant alt text
just makes a screen reader say it twice. Explicit `width`/`height` reserve the space so
the modal doesn't jump.

**Dismissible: yes**, with auto-close on the `online` event.
A blocking modal is defensible ("nothing works offline anyway") but it's actively worse
here: cached pages *do* work offline, so trapping the user behind an overlay hides
content that is perfectly usable. Dismissible + auto-reopen on the next failed request
covers both.

Re-opening logic: dismissal is remembered only until connectivity changes or the next
network failure — so `Dismiss` doesn't permanently silence it.

## Testing it via DevTools (goes in the README, verbatim steps)

1. Open `/table`, let page 1 load.
2. DevTools → Network → throttling dropdown → **Offline**.
3. Click **Next**. → `fetch` rejects → offline modal appears with the image; the
   previously loaded table stays visible behind it.
4. Set throttling back to **No throttling**. → the `online` event fires → modal
   auto-closes.
5. Click **Try again** → page loads.
6. Bonus (uncached page, still offline) → inline `ErrorState` + retry.
7. Bonus (cached page, still offline) → **loads from localStorage with no network** —
   this is the caching and offline features paying each other off.

Step 7 is worth calling out explicitly in the README; it's the moment the two "Features"
requirements combine into something that actually feels finished.

## Also: an ErrorBoundary

A single `<ErrorBoundary>` around `<AppRoutes>` catching render-time exceptions, showing
a "Something went wrong · Reload" screen. Not in the requirements, ~30 lines, and it's
the difference between a bug being a white screen and a bug being a message. Class
component, because that's still the only way to implement `componentDidCatch`.

## Definition of done

- [ ] DevTools Offline + Next → modal with a visible image
- [ ] Restoring the network auto-closes the modal
- [ ] Retry from the modal and from the inline banner both work
- [ ] A cached page still loads while offline
- [ ] Escape and backdrop click close the modal; focus returns to the trigger
- [ ] Tab cannot escape the open modal
- [ ] Page scroll is locked while the modal is open, with no layout shift
- [ ] Rapid page clicking produces no error flash from aborted requests
