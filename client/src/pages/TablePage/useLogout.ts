import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@routes/paths';

interface Logout {
  isLoggingOut: boolean;
  logout: () => void;
}

/**
 * Co-located with TablePage because nothing else signs out. Keeps the page component
 * responsible for layout and data wiring rather than navigation side effects.
 */
export const useLogout = (): Logout => {
  const { logout: endSession } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = (): void => {
    setIsLoggingOut(true);

    // The context clears local state before the request, so a failure still signs the
    // user out locally — which is what they asked for.
    void endSession().then(() => navigate(ROUTES.login, { replace: true }));
  };

  return { isLoggingOut, logout };
};
