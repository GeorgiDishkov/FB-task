import type { ComponentPropsWithRef } from 'react';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  label: string;
  /**
   * When set, the field renders as invalid and announces this message.
   *
   * `| undefined` is explicit because `exactOptionalPropertyTypes` is on: callers derive
   * this from validation and legitimately pass `undefined` to mean "no error", which is
   * different from omitting the prop.
   */
  error?: string | undefined;
}
