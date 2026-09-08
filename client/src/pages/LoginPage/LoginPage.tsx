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

      <p className={styles.disclaimer}>
        There is no user store: any username and password of 4–30 characters is accepted.
        The token lifecycle is real; the credential check is not.
      </p>
    </div>
  </main>
);
