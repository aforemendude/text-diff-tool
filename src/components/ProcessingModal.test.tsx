import { describe, expect, it, vi } from 'vitest';
import { findElement } from '../test/reactElements';
import Modal from './Modal';
import ProcessingModal from './ProcessingModal';

describe('ProcessingModal', () => {
  it('composes an unclosable status modal whose sole action terminates the comparison', () => {
    const onTerminate = vi.fn();
    const tree = ProcessingModal({ onTerminate });

    expect(tree.type).toBe(Modal);
    expect(tree.props).toMatchObject({
      title: 'Comparing Text',
      onClose: onTerminate,
      onAction: onTerminate,
      variant: 'info',
      actionLabel: 'Terminate',
      dismissible: false,
      className: 'processing-modal',
      bodyClassName: 'processing-modal__body',
      ariaDescribedBy: 'processing-modal-description',
    });
    expect(findElement(tree, (element) => element.props.className === 'processing-modal__spinner').props).toMatchObject(
      {
        'aria-hidden': 'true',
      },
    );
    expect(findElement(tree, (element) => element.type === 'p').props).toMatchObject({
      id: 'processing-modal-description',
      children: 'The comparison is still running. You can terminate it and return to editing.',
    });

    (tree.props.onAction as () => void)();

    expect(onTerminate).toHaveBeenCalledOnce();
  });
});
