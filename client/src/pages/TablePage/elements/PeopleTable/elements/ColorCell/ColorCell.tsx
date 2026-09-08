import { formatColor, isUnknownValue, toSwatchColor } from '@lib/format';

import type { ColorCellProps } from './types';

import styles from './ColorCell.module.scss';

export const ColorCell = ({ raw }: ColorCellProps) => {
  const isUnknown = isUnknownValue(raw);
  const swatch = toSwatchColor(raw);

  return (
    <span className={styles.cell} title={isUnknown ? raw : undefined}>
      {/* Decorative only — the text beside it already carries the value, so announcing
          the swatch would just repeat it. Absent for multi-valued or sentinel colours,
          where a single dot would be misleading rather than helpful. */}
      {swatch !== undefined && (
        <span
          aria-hidden="true"
          className={styles.swatch}
          style={{ background: swatch }}
        />
      )}
      <span className={isUnknown ? styles.unknown : undefined}>{formatColor(raw)}</span>
    </span>
  );
};
