import type { ComponentPropsWithRef } from 'react';

/**
 * Two variants, because two callers exist: the login submit and the table's log-out
 * button. No `size` prop and no 'ghost'/'danger' variants until something needs them
 * (AGENT.md §2).
 */
export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  /** Shows a spinner and disables the button while an action is in flight. */
  isLoading?: boolean;
}
