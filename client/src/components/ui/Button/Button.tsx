import { Spinner } from '@components/ui/Spinner';

import type { ButtonProps } from './types';

import styles from './Button.module.scss';

export const Button = ({
  variant = 'primary',
  isLoading = false,
  disabled = false,
  children,
  className,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    // A button that is busy must not be clickable again, whatever the caller passed.
    disabled={disabled || isLoading}
    className={[styles.button, styles[variant], className ?? '']
      .filter(Boolean)
      .join(' ')}
  >
    {/* aria-hidden: the button's own label already says what is happening ("Signing
        in…"), so the spinner's status text would announce the same thing twice. */}
    {isLoading && (
      <span aria-hidden="true" className={styles.spinner}>
        <Spinner label="" />
      </span>
    )}
    {children}
  </button>
);
