import { Spinner } from '@components/ui/Spinner';

import styles from './App.module.scss';

/**
 * Phase 0 placeholder. Replaced by BrowserRouter + AuthProvider + AppRoutes in Phase 2
 * (plan/FE/02-routing-auth.md).
 */
export const App = () => (
  <main className={styles.shell}>
    <div className={styles.card}>
      <p className={styles.eyebrow}>Phase 0</p>
      <h1 className={styles.title}>Scaffold is live</h1>
      <p className={styles.body}>
        Aliases, SCSS modules and design tokens all resolve. Routing lands in Phase 2.
      </p>
      <Spinner label="Waiting for Phase 2" />
    </div>
  </main>
);
