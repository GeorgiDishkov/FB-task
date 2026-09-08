import { flexRender } from '@tanstack/react-table';

import { NAME_COLUMN_ID } from '../../columns';

import type { PersonRowProps } from './types';

import styles from './PersonRow.module.scss';

/**
 * TanStack Table is headless — it computes the row model and emits no DOM — so the
 * element for each cell is our choice. That is what keeps this a real <table> with a
 * proper row header at every screen width.
 */
export const PersonRow = ({ row }: PersonRowProps) => (
  <tr className={styles.row}>
    {row.getVisibleCells().map((cell) => {
      const meta = cell.column.columnDef.meta;
      const content = flexRender(cell.column.columnDef.cell, cell.getContext());

      // The name labels its row, which is what a screen reader needs to make the other
      // cells mean anything. A flat guard inside a callback, so nesting stays at one.
      if (cell.column.id === NAME_COLUMN_ID) {
        return (
          <th key={cell.id} scope="row" className={styles.nameCell}>
            {content}
          </th>
        );
      }

      return (
        <td key={cell.id} data-label={meta?.label} data-align={meta?.align}>
          {content}
        </td>
      );
    })}
  </tr>
);
