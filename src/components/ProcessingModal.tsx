import Modal from './Modal';
import './ProcessingModal.css';

interface ProcessingModalProps {
  onTerminate: () => void;
}

function ProcessingModal({ onTerminate }: ProcessingModalProps) {
  return (
    <Modal
      title="Comparing Text"
      onClose={onTerminate}
      onAction={onTerminate}
      variant="info"
      actionLabel="Terminate"
      dismissible={false}
      className="processing-modal"
      bodyClassName="processing-modal__body"
    >
      <div className="processing-modal__status">
        <span className="processing-modal__spinner" aria-hidden="true" />
        <p>The comparison is still running. You can terminate it and return to editing.</p>
      </div>
    </Modal>
  );
}

export default ProcessingModal;
