import { ErrorState } from '../ErrorState';
import { Pagination } from '../Pagination';
import { PeopleTable } from '../PeopleTable';

import type { TableContentProps } from './types';

import styles from './TableContent.module.scss';

const FIRST_PAGE = 1;

const describeStatus = (props: TableContentProps): string => {
  const { state } = props;

  if (state.status === 'loading') {
    return 'Loading characters…';
  }

  if (state.status === 'success') {
    return `Showing page ${String(state.data.page)} of ${String(state.data.totalPages)}.`;
  }

  return '';
};

/**
 * Owns the async-state branching, so TablePage stays layout plus data wiring.
 *
 * The table is rendered whenever any data exists, including behind an error banner:
 * losing content you already had is worse than seeing it slightly stale.
 */
export const TableContent = (props: TableContentProps) => {
  const { state, page, onPageChange, onRetry } = props;
  const data = state.data;
  const isLoading = state.status === 'loading';
  // Perceptually different problems: a cold load has nothing to show, a page change
  // already has a table on screen.
  const isLoadingFirstPage = isLoading && data === null;

  return (
    <div className={styles.content}>
      {/* A loading state that exists only visually is half-built. */}
      <p role="status" aria-live="polite" className={styles.status}>
        {describeStatus(props)}
      </p>

      {state.status === 'error' && (
        <ErrorState
          error={state.error}
          isRetrying={isLoading}
          onRetry={onRetry}
          onGoToFirstPage={
            page === FIRST_PAGE ? undefined : () => onPageChange(FIRST_PAGE)
          }
        />
      )}

      {(data !== null || isLoadingFirstPage) && (
        <PeopleTable
          people={data?.people ?? []}
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          isRefreshing={isLoading && data !== null}
          isLoadingFirstPage={isLoadingFirstPage}
        />
      )}

      {data !== null && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          isDisabled={isLoading}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
