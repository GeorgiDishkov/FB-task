import { useId } from 'react';

import type { InputProps } from './types';

import styles from './Input.module.scss';

/**
 * No forwardRef: in React 19 `ref` is an ordinary prop, so it arrives with the rest and
 * is spread onto the input.
 *
 * Extends ComponentPropsWithRef<'input'> so placeholder, maxLength, autoComplete and
 * data-* all pass through without being re-declared.
 */
export const Input = ({
  label,
  error,
  id: providedId,
  className,
  ...rest
}: InputProps) => {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const hasError = error !== undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      <input
        {...rest}
        id={id}
        className={[styles.control, hasError ? styles.invalid : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        // `false` would render aria-invalid="false", which is valid but noisier than
        // omitting the attribute.
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
      />

      {/*
        Always present and always occupying its line height, so the layout does not jump
        when a message appears — and so the live region exists *before* text is inserted
        into it, which is what makes the change announceable.

        aria-live="polite", not role="alert": a field-level message should not interrupt
        what the user is doing. The form-level server error is the assertive one.
      */}
      <p id={errorId} aria-live="polite" className={styles.error}>
        {error}
      </p>
    </div>
  );
};
