import { Link } from 'react-router-dom';

import { ROUTES } from '@routes/paths';

import styles from './NotFoundPage.module.scss';

export const NotFoundPage = () => (
  <main className={styles.shell}>
    <h1 className={styles.title}>Page not found</h1>
    <Link to={ROUTES.login} className={styles.link}>
      Back to sign in
    </Link>
  </main>
);
