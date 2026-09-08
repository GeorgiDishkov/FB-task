import { Link } from 'react-router-dom';

import { ROUTES } from '@routes/paths';

import { RegisterForm } from './elements/RegisterForm';

import styles from './RegisterPage.module.scss';

export const RegisterPage = () => (
  <main className={styles.shell}>
    <div className={styles.card}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Star Wars archive</p>
        <h1 className={styles.title}>Create an account</h1>
      </header>

      <RegisterForm />

      <p className={styles.switch}>
        Already have an account? <Link to={ROUTES.login}>Log in</Link>
      </p>
    </div>
  </main>
);
