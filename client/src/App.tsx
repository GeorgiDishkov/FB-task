import { BrowserRouter } from 'react-router-dom';

import { ErrorBoundary } from '@components/ErrorBoundary';
import { OfflineModal } from '@components/OfflineModal';
import { AuthProvider } from '@context/AuthContext';
import { AppRoutes } from '@routes/AppRoutes';

export const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        {/* App level, not inside a page: the login form makes a request too, so a
            dropped connection must be reported wherever the user is. */}
        <OfflineModal />
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
