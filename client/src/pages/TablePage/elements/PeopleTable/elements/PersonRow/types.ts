import type { Row } from '@tanstack/react-table';

import type { Person } from '@/types';

export interface PersonRowProps {
  row: Row<Person>;
}
