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
}: ModalProps) {
  const titleClass = variant === 'info' ? 'modal__title modal__title--info' : 'modal__title';
  const modalClass = className ? `modal ${className}` : 'modal';
  const bodyClass = bodyClassName ? `modal__body ${bodyClassName}` : 'modal__body';

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className={titleClass}>{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={bodyClass}>
          {message === undefined ? children : <p className="modal__message">{message}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn-primary" onClick={onClose}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
