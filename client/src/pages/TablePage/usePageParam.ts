import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const FIRST_PAGE = 1;

interface PageParam {
  page: number;
  setPage: (page: number) => void;
}

/**
 * The URL is the single source of truth for which page is showing — not a useState that
 * would then need syncing with it. Page 4 is linkable and survives a refresh.
 *
 * Only the lower bound can be clamped here: the upper bound depends on totalPages, which
 * is not known until a response arrives.
 */
export const usePageParam = (): PageParam => {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = Number(searchParams.get('page') ?? FIRST_PAGE);
  // Guards ?page=abc (NaN), ?page=0, ?page=-3 and ?page=1.5 before any request goes out.
  const page = Number.isInteger(raw) && raw >= FIRST_PAGE ? raw : FIRST_PAGE;

  const setPage = useCallback(
    (next: number) => {
      // replace, so paging does not fill the history with entries to back out through.
      setSearchParams({ page: String(next) }, { replace: true });
    },
    [setSearchParams],
  );

  return { page, setPage };
};
