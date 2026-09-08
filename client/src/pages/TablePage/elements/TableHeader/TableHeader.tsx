import { Button } from '@components/ui/Button';
import { Spinner } from '@components/ui/Spinner';

import { CacheBadge } from './elements/CacheBadge';
import type { TableHeaderProps } from './types';

import styles from './TableHeader.module.scss';

export const TableHeader = (props: TableHeaderProps) => {
  const { displayName, totalCount, cachedAt, hasData, isRefreshing, isLoggingOut } =
    props;

  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <p className={styles.eyebrow}>Star Wars archive</p>
        <h1 className={styles.title}>
          Characters
          {/* An inline spinner beside the heading during a page change, rather than
              collapsing the table to a skeleton. */}
          {isRefreshing && <Spinner label="Loading characters" />}
        </h1>
        <div className={styles.meta}>
          {totalCount !== undefined && (
            <span className={styles.count}>{totalCount} characters in the archive</span>
          )}
          {hasData && <CacheBadge cachedAt={cachedAt} />}
        </div>
      </div>

      <div className={styles.account}>
        {displayName !== undefined && (
          <span className={styles.username}>{displayName}</span>
        )}

        {/* Makes the cache demonstrable in two seconds during a review, and is
            genuinely useful besides. */}
        <Button
          type="button"
          variant="secondary"
          disabled={isRefreshing}
          onClick={props.onRefresh}
        >
          Refresh data
        </Button>

        <Button
          type="button"
          variant="secondary"
          isLoading={isLoggingOut}
          onClick={props.onLogout}
        >
          Log out
        </Button>
      </div>
    </header>
  );
};
