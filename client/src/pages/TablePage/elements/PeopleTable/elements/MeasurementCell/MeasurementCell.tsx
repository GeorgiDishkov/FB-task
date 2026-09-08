import { formatMeasurement, isUnknownValue } from '@lib/format';

import type { MeasurementCellProps } from './types';

import styles from './MeasurementCell.module.scss';

/**
 * A sentinel renders as an em dash, with the raw value kept in `title` so no information
 * is actually lost — the grid just stays readable.
 */
export const MeasurementCell = ({ raw, unit }: MeasurementCellProps) => {
  const isUnknown = isUnknownValue(raw);

  return (
    <span
      className={styles.value}
      title={isUnknown ? raw : undefined}
      // Tabular figures so digits line up down the column.
      data-unknown={isUnknown ? 'true' : undefined}
    >
      {formatMeasurement(raw, unit)}
    </span>
  );
};
