type ReachabilityListener = (isReachable: boolean) => void;

const listeners = new Set<ReachabilityListener>();

const notify = (isReachable: boolean): void => {
  listeners.forEach((listener) => {
    listener(isReachable);
  });
};

/**
 * Bridges the fetch layer to React without a second context.
 *
 * `navigator.onLine === true` only means "there is a network interface", not "the
 * internet is reachable" — so a rejected fetch is the only signal that catches a captive
 * portal, a blocked request, or a server that is simply unreachable. services/http.ts
 * calls these; useOnlineStatus subscribes.
 */
export const reportNetworkFailure = (): void => {
  notify(false);
};

/**
 * Reported on any successful response. Without this, suspicion raised by a failed fetch
 * could only be cleared by an `online` event — which never fires when `navigator.onLine`
 * was true the whole time.
 */
export const reportNetworkSuccess = (): void => {
  notify(true);
};

export const subscribeToReachability = (listener: ReachabilityListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
