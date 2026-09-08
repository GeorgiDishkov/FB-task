import type { TableSkeletonProps } from './types';

import styles from './TableSkeleton.module.scss';

// Varied widths so the placeholder reads as text rather than a bar chart.
const WIDTHS = ['70%', '45%', '55%', '60%', '50%'];

/**
 * Sized to the real row height, so nothing shifts when data arrives — a spinner in a
 * void would collapse the layout and then push it back open.
 */
export const TableSkeleton = ({ rowCount, columnCount }: TableSkeletonProps) => (
  <>
    {Array.from({ length: rowCount }, (_unused, rowIndex) => (
      <tr key={rowIndex} className={styles.row}>
        {Array.from({ length: columnCount }, (_ignored, columnIndex) => (
          <td key={columnIndex} className={styles.cell}>
            <span
              className={styles.bar}
              style={{ width: WIDTHS[columnIndex % WIDTHS.length] }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);
