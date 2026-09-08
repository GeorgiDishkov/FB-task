export interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  /** Disabled while a request is in flight, so clicks cannot queue up. */
  isDisabled?: boolean;
  onPageChange: (page: number) => void;
}

/** A page number, or a gap where pages were elided. */
export type PageSlot = number | 'gap';
