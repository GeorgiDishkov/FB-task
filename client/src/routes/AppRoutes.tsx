import { Route, Routes } from 'react-router-dom';

import { LoginPage } from '@pages/LoginPage';
import { NotFoundPage } from '@pages/NotFoundPage';
import { TablePage } from '@pages/TablePage';

import { GuestOnlyRoute } from './GuestOnlyRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './paths';

export const AppRoutes = () => (
  <Routes>
    <Route
      path={ROUTES.login}
      element={
        <GuestOnlyRoute>
          <LoginPage />
        </GuestOnlyRoute>
      }
    />
    <Route
      path={ROUTES.table}
      element={
        <ProtectedRoute>
          <TablePage />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
