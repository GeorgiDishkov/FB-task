import { useContext } from 'react';

import { AuthContext } from '@context/AuthContext';
import type { AuthContextValue } from '@context/AuthContext';

/**
 * Throws on a missing provider, which is the whole reason to write this instead of
 * calling useContext directly: the return type is non-nullable, so no consumer needs
 * a null check or an optional chain.
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
};
