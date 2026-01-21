interface ModalProps {
  title: string;
  message: string;
  onClose: () => void;
  variant?: 'error' | 'info';
}

function Modal({ title, message, onClose, variant = 'error' }: ModalProps) {
  const titleClass =
    variant === 'info' ? 'modal__title modal__title--info' : 'modal__title';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className={titleClass}>{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__message">{message}</p>
        </div>
        <div className="modal__footer">
          <button className="btn btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
