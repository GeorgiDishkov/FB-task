import { describeAge } from '@lib/format';

import type { CacheBadgeProps } from './types';

import styles from './CacheBadge.module.scss';

/**
 * Turns an invisible feature into a visible one: without this, "is the cache working?"
 * can only be answered by watching the Network tab.
 */
export const CacheBadge = ({ cachedAt }: CacheBadgeProps) => {
  if (cachedAt === null) {
    return (
      <span className={`${styles.badge} ${styles.live}`}>
        <span aria-hidden="true" className={styles.dot} />
        Live
      </span>
    );
  }

  return (
    <span className={`${styles.badge} ${styles.cached}`}>
      <span aria-hidden="true" className={styles.dot} />
      Cached · {describeAge(cachedAt, Date.now())}
    </span>
  );
};
