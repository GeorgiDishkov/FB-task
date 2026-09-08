import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import {
  login as requestLogin,
  logout as requestLogout,
  refreshSession,
  register as requestRegister,
} from '@services/authService';
import type { AuthStatus, AuthUser } from '@/types';

import { AuthContext } from './AuthContext';
import type { AuthContextValue } from './types';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [user, setUser] = useState<AuthUser | null>(null);

  /**
   * Silent re-auth on mount. The access token is in memory and therefore gone after a
   * page reload, but the httpOnly refresh cookie survives — so this restores the session
   * without the user typing anything. A failure just means "not signed in".
   */
  useEffect(() => {
    let cancelled = false;

    const restore = async (): Promise<void> => {
      const restored = await refreshSession().catch(() => null);

      if (cancelled) {
        return;
      }

      setUser(restored);
      setStatus(restored === null ? 'anonymous' : 'authenticated');
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const loggedIn = await requestLogin(username, password);

    setUser(loggedIn);
    setStatus('authenticated');
  }, []);

  const register = useCallback(
    async (username: string, password: string, confirmPassword: string) => {
      const created = await requestRegister(username, password, confirmPassword);

      setUser(created);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async () => {
    // Clear local state first: even if the request fails, the user asked to be signed
    // out and the UI must honour that.
    setUser(null);
    setStatus('anonymous');

    await requestLogout().catch(() => undefined);
  }, []);

  // Memoised because the provider hands this object to every consumer — without it,
  // each provider render would be a new identity and defeat the point.
  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};
