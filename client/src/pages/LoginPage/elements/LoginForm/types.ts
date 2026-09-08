import type { LoginFormValues } from '@lib/validation';

export type TouchedFields = Record<keyof LoginFormValues, boolean>;
