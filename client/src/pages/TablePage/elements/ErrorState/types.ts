import type { AppError } from '@lib/errors';

export interface ErrorStateProps {
  error: AppError;
  isRetrying: boolean;
  onRetry: () => void;
  /** Offered only when the error is a 404, where retrying cannot help. */
  onGoToFirstPage?: (() => void) | undefined;
}
