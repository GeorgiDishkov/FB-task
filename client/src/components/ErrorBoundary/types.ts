import type { PropsWithChildren } from 'react';

export type ErrorBoundaryProps = PropsWithChildren;

export interface ErrorBoundaryState {
  hasError: boolean;
}
