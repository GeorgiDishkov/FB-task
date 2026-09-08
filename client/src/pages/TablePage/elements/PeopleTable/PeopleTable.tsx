import { getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { PAGE_SIZE } from '@services/constants';

import { peopleColumns } from './columns';
import { PersonRow } from './elements/PersonRow';
import { TableSkeleton } from './elements/TableSkeleton';
import type { PeopleTableProps } from './types';

import styles from './PeopleTable.module.scss';

export const PeopleTable = ({
  people,
  page,
  totalPages,
  isRefreshing = false,
  isLoadingFirstPage = false,
}: PeopleTableProps) => {
  const table = useReactTable({
    data: people,
    columns: peopleColumns,
    getCoreRowModel: getCoreRowModel(),
    // Our own id, never the array index — the API has none and names are not unique.
    getRowId: (person) => person.id,
    // Paging is server-side: `data` is already exactly this page's rows. Wiring
    // TanStack's pagination row model would paginate a single page of ten.
    manualPagination: true,
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  return (
    <div className={styles.wrapper}>
      <table className={`${styles.table} ${isRefreshing ? styles.refreshing : ''}`}>
        <caption className={styles.caption}>
          Star Wars characters, page {page} of {totalPages}
        </caption>

        {/* Read from the instance rather than hardcoded, so headers and cells can
            never disagree about order. */}
        <thead className={styles.head}>
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col">
                  {header.column.columnDef.meta?.label}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody className={styles.body}>
          {isLoadingFirstPage && (
            <TableSkeleton rowCount={PAGE_SIZE} columnCount={peopleColumns.length} />
          )}

          {!isLoadingFirstPage && rows.map((row) => <PersonRow key={row.id} row={row} />)}
        </tbody>
      </table>

      {!isLoadingFirstPage && rows.length === 0 && (
        <p className={styles.empty}>No characters on this page.</p>
      )}
    </div>
  );
};
