import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useLockBodyScroll } from '@hooks/useLockBodyScroll';

import { trapFocus } from './focusTrap';
import type { ModalProps } from './types';

import styles from './Modal.module.scss';

export const Modal = ({ title, onClose, children }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLockBodyScroll();

  // Move focus in, and put it back on close. Without the restore, closing dumps focus at
  // <body> and keyboard users lose their place entirely.
  useEffect(() => {
    const previouslyFocused = document.activeElement;

    panelRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      trapFocus(event, panelRef.current);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Portalled into <body> so the overlay escapes any ancestor with overflow: hidden or a
  // transform, either of which would clip a fixed-position element.
  return createPortal(
    <div
      role="presentation"
      className={styles.backdrop}
      // Compare target with currentTarget rather than stopping propagation on the panel:
      // a click that starts inside and ends on the backdrop must not close the dialog.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.panel}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
};
