import type { LoginFieldProps } from './types';

import styles from './LoginField.module.scss';

/**
 * Phase 2 stub field. Phase 3 replaces this with the shared Input primitive, which adds
 * useId-based label wiring, aria-invalid/aria-describedby, and a reserved error slot
 * (plan/FE/03-login-form.md).
 *
 * Spreads the native input props so placeholder, maxLength and autoComplete pass through
 * without being re-declared.
 */
export const LoginField = ({ label, ...inputProps }: LoginFieldProps) => (
  <label className={styles.field}>
    <span>{label}</span>
    <input {...inputProps} />
  </label>
);
