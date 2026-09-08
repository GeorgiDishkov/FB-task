import type { Person } from '@/types';

export interface PeopleTableProps {
  people: Person[];
  page: number;
  totalPages: number;
  /** Dims the table and blocks pointer input while a page change is in flight. */
  isRefreshing?: boolean;
  /** Draws placeholder rows instead of data, for the first load. */
  isLoadingFirstPage?: boolean;
}
