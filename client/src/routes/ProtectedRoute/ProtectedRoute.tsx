import { Navigate } from 'react-router-dom';

import { FullPageSpinner } from '@components/ui/FullPageSpinner';
import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@routes/paths';

import type { ProtectedRouteProps } from './types';

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { status } = useAuth();

  // Not optional: the in-memory access token is always absent at mount, so redirecting
  // here instead of waiting would sign the user out on every page refresh.
  if (status === 'bootstrapping') {
    return <FullPageSpinner />;
  }

  if (status === 'anonymous') {
    // replace, so Back does not ping-pong between guard and target.
    return <Navigate to={ROUTES.login} replace />;
  }

  return <>{children}</>;
};
