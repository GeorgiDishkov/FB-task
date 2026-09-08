import type { PeopleState } from '@hooks/usePeople';

export interface TableContentProps {
  state: PeopleState;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}
