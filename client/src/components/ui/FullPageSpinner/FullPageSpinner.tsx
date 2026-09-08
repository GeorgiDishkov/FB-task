import { Spinner } from '@components/ui/Spinner';

import type { FullPageSpinnerProps } from './types';

import styles from './FullPageSpinner.module.scss';

/** Shown while the session is being restored, so a guard never has to guess. */
export const FullPageSpinner = ({
  label = 'Checking your session',
}: FullPageSpinnerProps) => (
  <div className={styles.shell}>
    <Spinner label={label} />
  </div>
);
