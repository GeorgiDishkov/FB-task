import type { ComponentPropsWithoutRef } from 'react';

export interface LoginFieldProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
}
