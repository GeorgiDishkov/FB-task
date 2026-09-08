import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@context/AuthContext';
import { AuthRequestError } from '@services/authService';
import type { AuthContextValue } from '@context/AuthContext';

import { LoginForm } from './LoginForm';

const login = vi.fn<AuthContextValue['login']>();

const renderForm = () => {
  const value: AuthContextValue = {
    status: 'anonymous',
    user: null,
    login,
    register: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <AuthContext value={value}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/table" element={<p>table page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  );
};

const usernameInput = () => screen.getByLabelText('Username');
const passwordInput = () => screen.getByLabelText('Password');
const submitButton = () => screen.getByRole('button', { name: /log in/i });

beforeEach(() => {
  login.mockReset();
  login.mockResolvedValue(undefined);
});

describe('LoginForm', () => {
  it('starts with the button disabled and no errors on show', () => {
    renderForm();

    expect(submitButton()).toBeDisabled();
    expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
    expect(screen.queryByText(/at least 4 characters/)).not.toBeInTheDocument();
  });

  it('keeps the button disabled and shows an error for a too-short username', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(usernameInput(), 'abc');
    await user.tab();

    expect(
      screen.getByText('Username must be at least 4 characters.'),
    ).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('shows a required error for a field blurred while empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(usernameInput());
    await user.tab();

    expect(screen.getByText('Username is required.')).toBeInTheDocument();
  });

  it('enables the button once both fields are valid', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(usernameInput(), 'abcd');
    await user.type(passwordInput(), 'abcd');

    expect(submitButton()).toBeEnabled();
  });

  it('caps input length at 30 characters natively', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(usernameInput(), 'a'.repeat(40));

    expect(usernameInput()).toHaveValue('a'.repeat(30));
  });

  /** Mirrors the schema's asymmetry at the UI level: a password of spaces is valid. */
  it('accepts a password of only spaces', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(usernameInput(), 'georgi');
    await user.type(passwordInput(), '    ');

    expect(submitButton()).toBeEnabled();
  });

  it('submits the trimmed username and the raw password', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(usernameInput(), '  georgi  ');
    await user.type(passwordInput(), ' secret ');
    await user.click(submitButton());

    expect(login).toHaveBeenCalledExactlyOnceWith('georgi', ' secret ');
  });

  it('surfaces an unreachable server without disabling the form', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error('offline'));
    renderForm();

    await user.type(usernameInput(), 'admin');
    await user.type(passwordInput(), 'Password1!');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not reach the server/i,
    );
    expect(submitButton()).toBeEnabled();
  });

  /**
   * Rejected credentials and an unreachable server need different advice. The server
   * returns one code for both a wrong password and an unknown username, so this
   * message cannot reveal which it was.
   */
  it('reports rejected credentials distinctly from a connection failure', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(
      new AuthRequestError(
        'INVALID_CREDENTIALS',
        401,
        'Username or password is incorrect.',
      ),
    );
    renderForm();

    await user.type(usernameInput(), 'admin');
    await user.type(passwordInput(), 'wrongpass');
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(/username or password is incorrect/i);
    expect(alert).not.toHaveTextContent(/connection/i);
  });
});
