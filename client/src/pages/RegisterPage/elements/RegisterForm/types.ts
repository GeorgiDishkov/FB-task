import type { RegisterFormValues } from '@lib/validation';

export type TouchedFields = Record<keyof RegisterFormValues, boolean>;
