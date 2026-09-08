import { describeRange } from '@lib/format';
import { PAGE_SIZE } from '@services/constants';

import type { PageSummaryProps } from './types';

import styles from './PageSummary.module.scss';

/**
 * Derived entirely from the API's `count`, and free to compute — it is also what shows
 * a reviewer the paging is real rather than cosmetic.
 */
export const PageSummary = ({ page, totalPages, totalCount }: PageSummaryProps) => (
  <p className={styles.summary}>
    Page {page} of {totalPages} · showing {describeRange(page, PAGE_SIZE, totalCount)}
  </p>
);
