import { createContext } from 'react';

import type { AuthContextValue } from './types';

/** Undefined rather than a default value, so useAuth can throw on a missing provider
 *  and hand consumers a non-nullable type. */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
