import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@routes/paths';

import { LoginField } from './elements/LoginField';

import styles from './LoginPage.module.scss';

/**
 * Phase 2 stub. Deliberately plain: no Joi schema, no Input/Button primitives, no
 * touched-field error timing, no a11y polish. Phase 3 replaces the form entirely
 * (plan/FE/03-login-form.md) — this exists so the auth flow is demonstrable end to end.
 */
export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setServerError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      await navigate(ROUTES.table, { replace: true });
    } catch {
      setServerError('Username and password must each be 4–30 characters.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.shell}>
      <form
        className={styles.card}
        // void: the handler owns its own errors, and an async function passed straight
        // to a DOM attribute would turn a rejection into an unhandled one.
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <p className={styles.eyebrow}>Phase 2 stub</p>
        <h1 className={styles.title}>Sign in</h1>

        <LoginField
          label="Username"
          value={username}
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
        />

        <LoginField
          label="Password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />

        {serverError !== null && (
          <p role="alert" className={styles.error}>
            {serverError}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className={styles.hint}>
          Any username and password of 4–30 characters is accepted — there is no user
          store. The token lifecycle is real; the credential check is not.
        </p>
      </form>
    </main>
  );
};
