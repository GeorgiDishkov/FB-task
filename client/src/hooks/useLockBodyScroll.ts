import { useEffect } from 'react';

/**
 * Prevents the page behind a modal from scrolling, and compensates for the scrollbar's
 * width so the content underneath does not shift sideways as it disappears.
 */
export const useLockBodyScroll = (): void => {
  useEffect(() => {
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    body.style.paddingRight = `${String(scrollbarWidth)}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);
};
