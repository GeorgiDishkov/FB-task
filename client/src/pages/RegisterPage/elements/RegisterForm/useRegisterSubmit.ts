import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@hooks/useAuth';
import type { RegisterFormValues } from '@lib/validation';
import { ROUTES } from '@routes/paths';
import { AuthRequestError } from '@services/authService';

interface RegisterSubmit {
  isSubmitting: boolean;
  serverError: string | null;
  submit: (values: RegisterFormValues) => Promise<void>;
}

/**
 * A taken username is the one server-side failure this form can actually cause, and it
 * deserves its own message — "could not reach the server" would send the user to check
 * their wifi over a name collision.
 */
const toRegisterErrorMessage = (error: unknown): string => {
  if (!(error instanceof AuthRequestError)) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  if (error.code === 'USERNAME_TAKEN') {
    return 'That username is already taken. Try another.';
  }

  if (error.code === 'INVALID_CREDENTIALS_FORMAT') {
    return 'Username and password must each be 4–30 characters, and the passwords must match.';
  }

  return 'Could not create your account. Please try again.';
};

/** Co-located with RegisterForm because nothing else registers (AGENT.md §5). */
export const useRegisterSubmit = (): RegisterSubmit => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async (values: RegisterFormValues): Promise<void> => {
    // Guards a double-submit: two requests would race to claim the same username, and
    // one of them would lose with a confusing "already taken".
    if (isSubmitting) {
      return;
    }

    setServerError(null);
    setIsSubmitting(true);

    try {
      // Username trimmed to match the schema; passwords never are.
      await register(values.username.trim(), values.password, values.confirmPassword);
      // The server signs the new user in, so go straight to the table.
      await navigate(ROUTES.table, { replace: true });
    } catch (error) {
      setServerError(toRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, serverError, submit };
};
