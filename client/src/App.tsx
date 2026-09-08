import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '@context/AuthContext';
import { AppRoutes } from '@routes/AppRoutes';

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);
