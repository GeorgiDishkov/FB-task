import type { RowData } from '@tanstack/react-table';

/**
 * Types TanStack Table's per-column `meta` once, so it is not `unknown` at every read.
 *
 * `label` feeds each cell's `data-label` attribute, which the CSS-only mobile card
 * layout renders as the field name — so a label can never drift from its header.
 *
 * The type parameters must be named exactly as TanStack names them: TypeScript compares
 * them by name and rejects a mismatch with TS2428, even though neither is used here.
 * That is why this augmentation lives in a declaration file rather than beside the
 * column definitions — ambient type-only code, where the unused-variable rule for
 * runtime code does not apply.
 */
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    label: string;
    align?: 'end';
  }
}
