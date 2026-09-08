import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import {
  FIELD_MAX_LENGTH,
  FIELD_MIN_LENGTH,
  validateRegisterForm,
} from '@lib/validation';
import type { RegisterFormValues } from '@lib/validation';

import type { TouchedFields } from './types';
import { useRegisterSubmit } from './useRegisterSubmit';

import styles from './RegisterForm.module.scss';

const EMPTY_VALUES: RegisterFormValues = {
  username: '',
  password: '',
  confirmPassword: '',
};

const UNTOUCHED: TouchedFields = {
  username: false,
  password: false,
  confirmPassword: false,
};

interface FieldConfig {
  field: keyof RegisterFormValues;
  label: string;
  type: 'text' | 'password';
  autoComplete: string;
}

/**
 * The three inputs differ only in these four values. Described once rather than
 * repeated three times — the third occurrence of a shape is where extracting stops
 * being speculative (AGENT.md §2).
 *
 * autoComplete is 'new-password' on both password fields so a password manager offers
 * to generate one instead of autofilling the existing account.
 */
const FIELDS: FieldConfig[] = [
  { field: 'username', label: 'Username', type: 'text', autoComplete: 'username' },
  {
    field: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
  },
  {
    field: 'confirmPassword',
    label: 'Confirm password',
    type: 'password',
    autoComplete: 'new-password',
  },
];

export const RegisterForm = () => {
  const [values, setValues] = useState<RegisterFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState<TouchedFields>(UNTOUCHED);
  const { isSubmitting, serverError, submit } = useRegisterSubmit();

  // Derived during render, never mirrored into state via useEffect.
  const errors = validateRegisterForm(values);
  const canSubmit = Object.keys(errors).length === 0;

  const updateField = (field: keyof RegisterFormValues, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const markTouched = (field: keyof RegisterFormValues) => (): void => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const errorFor = (field: keyof RegisterFormValues): string | undefined =>
    touched[field] ? errors[field] : undefined;

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit(values);
      }}
    >
      {FIELDS.map((entry) => (
        <Input
          key={entry.field}
          label={entry.label}
          type={entry.type}
          value={values[entry.field]}
          error={errorFor(entry.field)}
          autoComplete={entry.autoComplete}
          maxLength={FIELD_MAX_LENGTH}
          onChange={(event) => updateField(entry.field, event.target.value)}
          onBlur={markTouched(entry.field)}
        />
      ))}

      {serverError !== null && (
        <p role="alert" className={styles.serverError}>
          {serverError}
        </p>
      )}

      <p className={styles.hint}>
        Username and password each need {FIELD_MIN_LENGTH}–{FIELD_MAX_LENGTH} characters.
      </p>

      <Button type="submit" disabled={!canSubmit} isLoading={isSubmitting}>
        {isSubmitting ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  );
};
