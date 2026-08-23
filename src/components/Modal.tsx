import { useEffect, useId, useRef, type ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  title: string;
  message?: string;
  children?: ReactNode;
  onClose: () => void;
  variant?: 'error' | 'info';
  className?: string;
  bodyClassName?: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
  ariaDescribedBy?: string;
}

function Modal({
  title,
  message,
  children,
  onClose,
  variant = 'error',
  className,
  bodyClassName,
  actionLabel = 'OK',
  onAction = onClose,
  dismissible = true,
  ariaDescribedBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  const titleClass = variant === 'error' ? 'modal__title' : `modal__title modal__title--${variant}`;
  const modalClass = className ? `modal ${className}` : 'modal';
  const bodyClass = bodyClassName ? `modal__body ${bodyClassName}` : 'modal__body';

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal__overlay"
      aria-labelledby={titleId}
      aria-describedby={message === undefined ? ariaDescribedBy : messageId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') {
          return;
        }

        const dialog = dialogRef.current;
        if (!dialog) {
          return;
        }

        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute('disabled'));
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements.at(-1);

        if (!firstFocusable || !lastFocusable) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        if (event.shiftKey && (document.activeElement === firstFocusable || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === lastFocusable || !dialog.contains(document.activeElement))
        ) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }}
    >
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 id={titleId} className={titleClass}>
            {title}
          </h2>
          {dismissible && (
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close" autoFocus>
              ×
            </button>
          )}
        </div>
        <div className={bodyClass}>
          {message === undefined ? (
            children
          ) : (
            <p id={messageId} className="modal__message">
              {message}
            </p>
          )}
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn-primary" onClick={onAction} autoFocus={!dismissible}>
            {actionLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default Modal;
