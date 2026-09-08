import { useEffect } from 'react';

import { useAuth } from '@hooks/useAuth';
import { usePeople } from '@hooks/usePeople';

import { TableContent } from './elements/TableContent';
import { TableHeader } from './elements/TableHeader';
import { usePageParam } from './usePageParam';
import { useLogout } from './useLogout';

import styles from './TablePage.module.scss';

export const TablePage = () => {
  const { user } = useAuth();
  const { isLoggingOut, logout } = useLogout();
  const { page, setPage } = usePageParam();
  const { state, retry, refresh } = usePeople(page);

  const data = state.data;

  /**
   * The upper page bound can only be enforced once totalPages is known, so it is
   * corrected here rather than in usePageParam. Typing ?page=99 directly is handled by
   * the error state instead — that request fails before any count exists.
   */
  useEffect(() => {
    if (data === null || page <= data.totalPages) {
      return;
    }

    setPage(data.totalPages);
  }, [data, page, setPage]);

  return (
    <main className={styles.shell}>
      <TableHeader
        displayName={user?.displayName}
        totalCount={data?.totalCount}
        cachedAt={state.cachedAt}
        hasData={data !== null}
        isRefreshing={state.status === 'loading' && data !== null}
        isLoggingOut={isLoggingOut}
        onRefresh={refresh}
        onLogout={logout}
      />

      <TableContent state={state} page={page} onPageChange={setPage} onRetry={retry} />
    </main>
  );
};
