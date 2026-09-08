import { describe, expect, it } from 'vitest';

import { buildPageSlots } from './pageSlots';
import type { PageSlot } from './types';

// Hoisted: describe -> it -> filter would be three nested callbacks (AGENT.md §3).
const onlyNumbers = (slots: PageSlot[]): number[] =>
  slots.filter((slot): slot is number => slot !== 'gap');

describe('buildPageSlots', () => {
  it('lists every page when they all fit', () => {
    expect(buildPageSlots(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('always includes the first and last page', () => {
    const slots = buildPageSlots(5, 9);

    expect(slots[0]).toBe(1);
    expect(slots.at(-1)).toBe(9);
  });

  it('windows around the current page with gaps', () => {
    expect(buildPageSlots(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
  });

  it('omits a gap that would hide a single page', () => {
    expect(buildPageSlots(3, 9)).toEqual([1, 2, 3, 4, 'gap', 9]);
  });

  it('never emits a page outside the range', () => {
    const slots = onlyNumbers(buildPageSlots(1, 9));

    expect(Math.min(...slots)).toBe(1);
    expect(Math.max(...slots)).toBe(9);
  });

  it('handles a single page without duplicating it', () => {
    expect(buildPageSlots(1, 1)).toEqual([1]);
  });
});
