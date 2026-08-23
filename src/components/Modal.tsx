import type { ReactNode } from 'react';
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
}: ModalProps) {
  const titleClass = variant === 'error' ? 'modal__title' : `modal__title modal__title--${variant}`;
  const modalClass = className ? `modal ${className}` : 'modal';
  const bodyClass = bodyClassName ? `modal__body ${bodyClassName}` : 'modal__body';

  return (
    <div className="modal__overlay" onClick={dismissible ? onClose : undefined}>
      <div
        className={modalClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal__header">
          <h2 className={titleClass}>{title}</h2>
          {dismissible && (
            <button className="modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className={bodyClass}>
          {message === undefined ? children : <p className="modal__message">{message}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn-primary" onClick={onAction} autoFocus={!dismissible}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
