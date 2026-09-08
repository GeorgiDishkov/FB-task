import { Link } from 'react-router-dom';

import { ROUTES } from '@routes/paths';

import { LoginForm } from './elements/LoginForm';

import styles from './LoginPage.module.scss';

/** Pure layout. The form owns its own state, so it could be dropped into a modal
 *  later without touching either file. */
export const LoginPage = () => (
  <main className={styles.shell}>
    <div className={styles.card}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Star Wars archive</p>
        <h1 className={styles.title}>Log in</h1>
      </header>

      <LoginForm />

      <p className={styles.switch}>
        No account yet? <Link to={ROUTES.register}>Create one</Link>
      </p>

      {/* A demo login nobody can guess is a demo nobody can try. The account is seeded
          in the server's user store as a salted bcrypt hash — the password below is
          verified against it, not waved through. */}
      <div className={styles.demo}>
        <p className={styles.demoTitle}>Demo account</p>
        <dl className={styles.credentials}>
          <dt>Username</dt>
          <dd>
            <code>admin</code>
          </dd>
          <dt>Password</dt>
          <dd>
            <code>Password1!</code>
          </dd>
        </dl>
      </div>
    </div>
  </main>
);
