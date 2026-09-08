import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@context/AuthContext';
import type { AuthContextValue } from '@context/AuthContext';
import type { AuthStatus } from '@/types';

import { ProtectedRoute } from './ProtectedRoute';

const renderAt = (status: AuthStatus) => {
  const value: AuthContextValue = {
    status,
    user: status === 'authenticated' ? { username: 'georgi' } : null,
    login: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <AuthContext value={value}>
      <MemoryRouter initialEntries={['/table']}>
        <Routes>
          <Route path="/" element={<p>login page</p>} />
          <Route
            path="/table"
            element={
              <ProtectedRoute>
                <p>protected content</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  );
};

describe('ProtectedRoute', () => {
  it('renders the protected content when authenticated', () => {
    renderAt('authenticated');

    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects to the login page when anonymous', () => {
    renderAt('anonymous');

    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  /**
   * The regression guard for this phase's main hazard. The access token lives in memory,
   * so it is always absent at mount; if this branch ever collapses into the anonymous
   * one, a signed-in user gets bounced to the login page on every page refresh.
   */
  it('waits while bootstrapping instead of redirecting', () => {
    renderAt('bootstrapping');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
});
