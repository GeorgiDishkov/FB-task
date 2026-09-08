import { Button } from '@components/ui/Button';

import { PageButton } from './elements/PageButton';
import { PageSummary } from './elements/PageSummary';
import { buildPageSlots } from './pageSlots';
import type { PaginationProps } from './types';

import styles from './Pagination.module.scss';

export const Pagination = ({
  page,
  totalPages,
  totalCount,
  isDisabled = false,
  onPageChange,
}: PaginationProps) => {
  const slots = buildPageSlots(page, totalPages);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <nav className={styles.nav} aria-label="Pagination">
      <div className={styles.controls}>
        <Button
          type="button"
          variant="secondary"
          disabled={isDisabled || isFirst}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Prev
        </Button>

        {/* Real buttons driven by state, not anchors — an anchor here would reload the
            whole app. Hidden below md, where PageSummary already states the position. */}
        <ol className={styles.pages}>
          {slots.map((slot, index) => (
            <li key={slot === 'gap' ? `gap-${String(index)}` : slot}>
              {slot === 'gap' ? (
                <span aria-hidden="true" className={styles.gap}>
                  …
                </span>
              ) : (
                <PageButton
                  page={slot}
                  isCurrent={slot === page}
                  isDisabled={isDisabled}
                  onSelect={onPageChange}
                />
              )}
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="secondary"
          disabled={isDisabled || isLast}
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </Button>
      </div>

      <PageSummary page={page} totalPages={totalPages} totalCount={totalCount} />
    </nav>
  );
};
