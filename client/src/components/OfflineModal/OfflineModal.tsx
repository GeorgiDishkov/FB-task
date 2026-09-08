import { useEffect, useState } from 'react';

import offlineImage from '@assets/offline.svg';
import { Button } from '@components/ui/Button';
import { Modal } from '@components/ui/Modal';
import { useOnlineStatus } from '@hooks/useOnlineStatus';

import styles from './OfflineModal.module.scss';

/**
 * Mounted at app level, so it reports a dropped connection wherever the user happens to
 * be — the login form makes a request too, not just the table.
 *
 * Dismissible rather than blocking: cached pages remain perfectly usable offline, so
 * trapping the user behind an overlay would hide content that still works. Dismissal is
 * remembered only until connectivity changes, so the next drop shows it again.
 */
export const OfflineModal = () => {
  const { isOnline, recheck } = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || isDismissed) {
    return null;
  }

  return (
    <Modal
      title="You're offline"
      onClose={() => {
        setIsDismissed(true);
      }}
    >
      {/*
        A LOCAL asset, deliberately. A remote illustration cannot load in the one state
        this modal exists for, so it would render as a broken-image icon exactly when it
        is needed. Vite inlines this as a data URI, so it needs no network at all.

        Decorative: the heading already carries the message, and a duplicate alt text
        would make a screen reader say it twice.
      */}
      <img
        src={offlineImage}
        alt=""
        aria-hidden="true"
        width={160}
        height={112}
        className={styles.image}
      />

      <p className={styles.body}>
        We can&apos;t reach the Star Wars API right now. Any pages you already loaded are
        still readable — they came from your browser&apos;s cache.
      </p>

      <div className={styles.actions}>
        <Button type="button" onClick={recheck}>
          Check again
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setIsDismissed(true);
          }}
        >
          Dismiss
        </Button>
      </div>
    </Modal>
  );
};
