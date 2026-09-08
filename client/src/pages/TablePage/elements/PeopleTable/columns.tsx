import { createColumnHelper } from '@tanstack/react-table';

import type { Person } from '@/types';

import { ColorCell } from './elements/ColorCell';
import { MeasurementCell } from './elements/MeasurementCell';

// ColumnMeta is typed in src/types/tanstack-table.d.ts.
const columnHelper = createColumnHelper<Person>();

export const NAME_COLUMN_ID = 'name';

/**
 * Exactly the five specified columns, in the specified order. createColumnHelper<Person>
 * ties every accessor key to the model, so a typo or a renamed field is a compile error
 * rather than a silently empty column.
 */
export const peopleColumns = [
  columnHelper.accessor('name', {
    header: 'Name',
    meta: { label: 'Name' },
  }),
  columnHelper.accessor('mass', {
    header: 'Mass',
    meta: { label: 'Mass', align: 'end' },
    cell: (info) => <MeasurementCell raw={info.getValue()} unit="kg" />,
  }),
  columnHelper.accessor('height', {
    header: 'Height',
    meta: { label: 'Height', align: 'end' },
    cell: (info) => <MeasurementCell raw={info.getValue()} unit="cm" />,
  }),
  columnHelper.accessor('hairColor', {
    header: 'Hair color',
    meta: { label: 'Hair color' },
    cell: (info) => <ColorCell raw={info.getValue()} />,
  }),
  columnHelper.accessor('skinColor', {
    header: 'Skin color',
    meta: { label: 'Skin color' },
    cell: (info) => <ColorCell raw={info.getValue()} />,
  }),
];
