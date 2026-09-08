import { Button } from '@components/ui/Button';
import { Spinner } from '@components/ui/Spinner';

import type { TableHeaderProps } from './types';

import styles from './TableHeader.module.scss';

export const TableHeader = ({
  username,
  totalCount,
  isRefreshing,
  isLoggingOut,
  onLogout,
}: TableHeaderProps) => (
  <header className={styles.header}>
    <div className={styles.titles}>
      <p className={styles.eyebrow}>Star Wars archive</p>
      <h1 className={styles.title}>
        Characters
        {/* An inline spinner beside the heading during a page change, rather than
            collapsing the table to a skeleton. */}
        {isRefreshing && <Spinner label="Loading characters" />}
      </h1>
      {totalCount !== undefined && (
        <p className={styles.count}>{totalCount} characters in the archive</p>
      )}
    </div>

    <div className={styles.account}>
      {username !== undefined && <span className={styles.username}>{username}</span>}
      <Button
        type="button"
        variant="secondary"
        isLoading={isLoggingOut}
        onClick={onLogout}
      >
        Log out
      </Button>
    </div>
  </header>
);
