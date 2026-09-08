const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Keeps Tab and Shift+Tab inside the dialog. Hand-rolled rather than pulling in
 * focus-trap-react: the whole behaviour is the two wrap-around cases below.
 */
export const trapFocus = (event: KeyboardEvent, panel: HTMLElement | null): void => {
  if (panel === null) {
    return;
  }

  const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  const first = focusable[0];
  const last = focusable.at(-1);

  if (first === undefined || last === undefined) {
    return;
  }

  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};
