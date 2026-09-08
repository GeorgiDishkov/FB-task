import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reportNetworkFailure, reportNetworkSuccess } from '@lib/connectivity';

import { OfflineModal } from './OfflineModal';

const setBrowserOnline = (isOnline: boolean): void => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => isOnline,
  });
};

const fireWindowEvent = (name: string): void => {
  act(() => {
    window.dispatchEvent(new Event(name));
  });
};

// Hoisted out of the test bodies: describe -> it -> act would be three nested
// callbacks, which AGENT.md §3 caps at two.
const reportFailure = (): void => {
  act(() => {
    reportNetworkFailure();
  });
};

const reportSuccess = (): void => {
  act(() => {
    reportNetworkSuccess();
  });
};

const dialog = () => screen.queryByRole('dialog');

beforeEach(() => {
  setBrowserOnline(true);
});

afterEach(() => {
  setBrowserOnline(true);
});

describe('OfflineModal', () => {
  it('renders nothing while online', () => {
    render(<OfflineModal />);

    expect(dialog()).not.toBeInTheDocument();
  });

  it('appears when the browser reports offline', () => {
    render(<OfflineModal />);

    setBrowserOnline(false);
    fireWindowEvent('offline');

    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /offline/i })).toBeInTheDocument();
  });

  /**
   * The requirement asks for a modal "with an image inside", and the image must be local:
   * a remote one cannot load in the very state this modal exists for.
   */
  it('contains a decorative image', () => {
    setBrowserOnline(false);
    render(<OfflineModal />);

    const image = dialog()?.querySelector('img');

    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * navigator.onLine === true is an unreliable positive, so a rejected request has to be
   * able to raise the alarm on its own.
   */
  it('appears on a reported request failure even while the browser claims to be online', () => {
    render(<OfflineModal />);

    reportFailure();

    expect(navigator.onLine).toBe(true);
    expect(dialog()).toBeInTheDocument();
  });

  it('closes again when a later request succeeds', () => {
    render(<OfflineModal />);

    reportFailure();
    reportSuccess();

    expect(dialog()).not.toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    setBrowserOnline(false);
    render(<OfflineModal />);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(dialog()).not.toBeInTheDocument();
  });

  /** Dismissal must not permanently silence it. */
  it('reappears on the next drop after being dismissed', async () => {
    const user = userEvent.setup();
    setBrowserOnline(false);
    render(<OfflineModal />);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    setBrowserOnline(true);
    fireWindowEvent('online');
    setBrowserOnline(false);
    fireWindowEvent('offline');

    expect(dialog()).toBeInTheDocument();
  });

  it('auto-closes on reconnect with no user action', () => {
    setBrowserOnline(false);
    render(<OfflineModal />);

    expect(dialog()).toBeInTheDocument();

    setBrowserOnline(true);
    fireWindowEvent('online');

    expect(dialog()).not.toBeInTheDocument();
  });
});
