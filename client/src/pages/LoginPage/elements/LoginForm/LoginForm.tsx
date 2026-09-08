import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { FIELD_MAX_LENGTH, FIELD_MIN_LENGTH, validateLoginForm } from '@lib/validation';
import type { LoginFormValues } from '@lib/validation';

import type { TouchedFields } from './types';
import { useLoginSubmit } from './useLoginSubmit';

import styles from './LoginForm.module.scss';

const EMPTY_VALUES: LoginFormValues = { username: '', password: '' };
const UNTOUCHED: TouchedFields = { username: false, password: false };

export const LoginForm = () => {
  const [values, setValues] = useState<LoginFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState<TouchedFields>(UNTOUCHED);
  const { isSubmitting, serverError, submit } = useLoginSubmit();

  // Derived during render — never mirrored into state via useEffect. Mirroring derived
  // data is the most common React anti-pattern and would cost a render cycle plus a
  // class of stale-value bugs. Two short strings against a compiled schema is cheap
  // enough that useMemo would be noise.
  const errors = validateLoginForm(values);
  const canSubmit = Object.keys(errors).length === 0;

  const updateField = (field: keyof LoginFormValues, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const markTouched = (field: keyof LoginFormValues) => (): void => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  /** A message shows once its field has been blurred, then tracks it live as they type. */
  const errorFor = (field: keyof LoginFormValues): string | undefined =>
    touched[field] ? errors[field] : undefined;

  return (
    <form
      className={styles.form}
      noValidate
      // void: the hook owns its errors, and an async function passed straight to a DOM
      // attribute would turn a rejection into an unhandled one.
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit(values);
      }}
    >
      <Input
        label="Username"
        value={values.username}
        error={errorFor('username')}
        autoComplete="username"
        maxLength={FIELD_MAX_LENGTH}
        onChange={(event) => updateField('username', event.target.value)}
        onBlur={markTouched('username')}
      />

      <Input
        label="Password"
        type="password"
        value={values.password}
        error={errorFor('password')}
        autoComplete="current-password"
        maxLength={FIELD_MAX_LENGTH}
        onChange={(event) => updateField('password', event.target.value)}
        onBlur={markTouched('password')}
      />

      {serverError !== null && (
        <p role="alert" className={styles.serverError}>
          {serverError}
        </p>
      )}

      {/* The honest answer to "why is the button greyed out", for everyone — a truly
          disabled button is not focusable and announces nothing. */}
      <p className={styles.hint}>
        Both fields need {FIELD_MIN_LENGTH}–{FIELD_MAX_LENGTH} characters.
      </p>

      <Button type="submit" disabled={!canSubmit} isLoading={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Log in'}
      </Button>
    </form>
  );
};
