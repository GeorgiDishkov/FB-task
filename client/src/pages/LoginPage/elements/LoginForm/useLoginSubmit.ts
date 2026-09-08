import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@hooks/useAuth';
import { AuthRequestError } from '@services/authService';
import type { LoginFormValues } from '@lib/validation';
import { ROUTES } from '@routes/paths';

interface LoginSubmit {
  isSubmitting: boolean;
  serverError: string | null;
  submit: (values: LoginFormValues) => Promise<void>;
}

/**
 * Rejected credentials and an unreachable server are different problems and deserve
 * different advice: one means "check what you typed", the other "check your connection".
 * Collapsing them into one message would send the user looking in the wrong place.
 *
 * The server returns the same code for a wrong password and an unknown username, so this
 * cannot accidentally reveal which one it was.
 */
const toLoginErrorMessage = (error: unknown): string => {
  if (error instanceof AuthRequestError && error.code === 'INVALID_CREDENTIALS') {
    return 'Username or password is incorrect.';
  }

  if (error instanceof AuthRequestError && error.code === 'INVALID_CREDENTIALS_FORMAT') {
    return 'Username and password must each be 4–30 characters.';
  }

  return 'Could not reach the server. Check your connection and try again.';
};

/**
 * Owns the network side of signing in: call the API, navigate on success, turn a failure
 * into something a user can read. Co-located with LoginForm because nothing else needs
 * it — if a second caller appears it moves to src/hooks (AGENT.md §5).
 *
 * Keeping it out of the component leaves LoginForm responsible only for values, touched
 * state, derived errors and rendering.
 */
export const useLoginSubmit = (): LoginSubmit => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async (values: LoginFormValues): Promise<void> => {
    // Guards a double-submit from a held Enter key or a fast double-click in the gap
    // before the request resolves — two logins would create two sessions.
    if (isSubmitting) {
      return;
    }

    setServerError(null);
    setIsSubmitting(true);

    try {
      // Trimmed to match the schema, which trims the username but never the password.
      await login(values.username.trim(), values.password);
      await navigate(ROUTES.table, { replace: true });
    } catch (error) {
      setServerError(toLoginErrorMessage(error));
    } finally {
      // Both paths, so a failed attempt leaves a usable form rather than a
      // permanently disabled button.
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, serverError, submit };
};
