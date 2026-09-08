import type { PageButtonProps } from './types';

import styles from './PageButton.module.scss';

export const PageButton = ({
  page,
  isCurrent,
  isDisabled,
  onSelect,
}: PageButtonProps) => (
  <button
    type="button"
    className={styles.page}
    // aria-current marks the active page for assistive technology; the visual state
    // alone would not.
    aria-current={isCurrent ? 'page' : undefined}
    aria-label={`Page ${String(page)}`}
    disabled={isDisabled}
    onClick={() => onSelect(page)}
  >
    {page}
  </button>
);
