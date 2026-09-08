import { Component } from 'react';

import { Button } from '@components/ui/Button';

import type { ErrorBoundaryProps, ErrorBoundaryState } from './types';

import styles from './ErrorBoundary.module.scss';

/**
 * Catches render-time exceptions anywhere below it, which no hook can do —
 * componentDidCatch is still class-only. Not in the requirements, but it is the
 * difference between a bug being a white screen and a bug being a message.
 *
 * Fields are declared explicitly; erasableSyntaxOnly rejects parameter properties.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error('[app] Unhandled render error:', error);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className={styles.shell}>
        <div className={styles.panel}>
          <h1>Something went wrong</h1>
          <p className={styles.body}>
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <Button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload the page
          </Button>
        </div>
      </main>
    );
  }
}
