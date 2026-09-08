import { useCallback, useEffect, useState } from 'react';

import { subscribeToReachability } from '@lib/connectivity';

interface OnlineStatus {
  isOnline: boolean;
  /** Clears suspicion raised by a failed request, so the next one can re-establish it. */
  recheck: () => void;
}

/**
 * Two signals, unioned, because neither is sufficient alone:
 *
 * - `navigator.onLine === false` is a reliable *negative* — definitely offline.
 * - `navigator.onLine === true` is an unreliable positive, so a rejected fetch is
 *   treated as offline even when the browser claims otherwise.
 *
 * See plan/FE/06-offline-and-errors.md.
 */
export const useOnlineStatus = (): OnlineStatus => {
  // Lazy initialiser: read once, synchronously. An effect-based read would render one
  // frame claiming "online" before correcting itself.
  const [isBrowserOnline, setIsBrowserOnline] = useState(() => navigator.onLine);
  const [isReachable, setIsReachable] = useState(true);

  useEffect(() => {
    const goOnline = (): void => {
      setIsBrowserOnline(true);
      // Recovery is automatic: the modal closes without the user doing anything.
      setIsReachable(true);
    };

    const goOffline = (): void => {
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => subscribeToReachability(setIsReachable), []);

  const recheck = useCallback(() => {
    setIsReachable(true);
  }, []);

  return { isOnline: isBrowserOnline && isReachable, recheck };
};
