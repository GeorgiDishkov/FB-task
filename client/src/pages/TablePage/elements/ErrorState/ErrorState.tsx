import { Button } from '@components/ui/Button';
import { toUserMessage } from '@lib/errors';

import type { ErrorStateProps } from './types';

import styles from './ErrorState.module.scss';

const NOT_FOUND = 404;

/**
 * Rendered above the table rather than in place of it: if a previous page is still in
 * state it stays readable below. Losing content you already had is worse than seeing it
 * slightly stale.
 */
export const ErrorState = ({
  error,
  isRetrying,
  onRetry,
  onGoToFirstPage,
}: ErrorStateProps) => {
  const isNotFound = error.status === NOT_FOUND;

  return (
    <div role="alert" className={styles.panel}>
      <p className={styles.message}>
        <span aria-hidden="true">⚠ </span>
        {toUserMessage(error)}
      </p>

      <div className={styles.actions}>
        {/* Retry is useless advice for a 404, so it is not offered there. */}
        {!isNotFound && (
          <Button type="button" isLoading={isRetrying} onClick={onRetry}>
            Try again
          </Button>
        )}

        {isNotFound && onGoToFirstPage !== undefined && (
          <Button type="button" onClick={onGoToFirstPage}>
            Go to the first page
          </Button>
        )}
      </div>
    </div>
  );
};
