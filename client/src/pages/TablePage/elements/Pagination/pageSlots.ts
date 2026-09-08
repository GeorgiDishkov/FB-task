import type { PageSlot } from './types';

/** How many pages to show either side of the current one. */
const WINDOW = 1;

/**
 * Windowed page numbers: first, last, the current page and its neighbours, with gaps
 * where pages were elided. Nine pages would fit without this, but ninety would not, and
 * the windowing is what makes the control independent of the dataset size.
 *
 * Pure and exported so it can be tested without rendering anything.
 */
export const buildPageSlots = (page: number, totalPages: number): PageSlot[] => {
  const shown = new Set<number>([1, totalPages, page]);

  for (let offset = 1; offset <= WINDOW; offset += 1) {
    shown.add(page - offset);
    shown.add(page + offset);
  }

  const pages = [...shown]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);

  return pages.flatMap<PageSlot>((current, index) => {
    const previous = pages[index - 1];

    if (previous === undefined || current - previous === 1) {
      return [current];
    }

    // An ellipsis hiding exactly one page is no narrower than the page it hides, and
    // strictly less useful — so show the page instead.
    if (current - previous === 2) {
      return [current - 1, current];
    }

    return ['gap', current];
  });
};
