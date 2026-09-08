import type { SpinnerProps } from './types';

import styles from './Spinner.module.scss';

const DEFAULT_LABEL = 'Loading';

export const Spinner = ({ label = DEFAULT_LABEL, className }: SpinnerProps) => (
  <span className={className}>
    <span aria-hidden="true" className={styles.ring} />
    <span role="status" className={styles.label}>
      {label}
    </span>
  </span>
);
