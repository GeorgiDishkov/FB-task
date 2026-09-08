import { useNavigate } from 'react-router-dom';

import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@routes/paths';

import styles from './TablePage.module.scss';

/**
 * Phase 2 stub. The table, pagination, caching and offline handling arrive in phases
 * 4–6; this exists so the protected route and the logout path are demonstrable.
 */
export const TablePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    await navigate(ROUTES.login, { replace: true });
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Phase 2 stub</p>
          <h1 className={styles.title}>Star Wars characters</h1>
        </div>
        <div className={styles.account}>
          <span className={styles.username}>{user?.username}</span>
          <button
            type="button"
            className={styles.logout}
            onClick={() => {
              void handleLogout();
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <p className={styles.body}>
        You reached a protected route, so the session survived the guard. Refresh this
        page: the access token is in memory and therefore gone, but the httpOnly refresh
        cookie restores the session without a redirect.
      </p>
      <p className={styles.body}>The data table lands in Phase 4.</p>
    </main>
  );
};
