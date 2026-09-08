import { Navigate } from 'react-router-dom';

import { FullPageSpinner } from '@components/ui/FullPageSpinner';
import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@routes/paths';

import type { GuestOnlyRouteProps } from './types';

export const GuestOnlyRoute = ({ children }: GuestOnlyRouteProps) => {
  const { status } = useAuth();

  // Waits for the same reason ProtectedRoute does: otherwise a refresh on "/" flashes
  // the login form at someone who is already signed in.
  if (status === 'bootstrapping') {
    return <FullPageSpinner />;
  }

  if (status === 'authenticated') {
    return <Navigate to={ROUTES.table} replace />;
  }

  return <>{children}</>;
};
