import { describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from '../test/reactElements';
import Modal from './Modal';

describe('Modal', () => {
  it('renders the default error message contract and closes from every exposed control', () => {
    const onClose = vi.fn();
    const tree = Modal({ title: 'Failure', message: 'Something failed', onClose });

    expect(tree.props.className).toBe('modal__overlay');
    const modal = findElement(tree, (element) => element.props.className === 'modal');
    const title = findElement(tree, (element) => element.type === 'h2');
    const message = findElement(tree, (element) => element.props.className === 'modal__message');
    const buttons = findElements(tree, (element) => element.type === 'button');

    expect(title.props).toMatchObject({ className: 'modal__title', children: 'Failure' });
    expect(message.props.children).toBe('Something failed');
    expect(buttons.map((button) => button.props.children)).toEqual(['×', 'OK']);

    (tree.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    (buttons[0].props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(2);
    (buttons[1].props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(3);

    const stopPropagation = vi.fn();
    (modal.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it('renders informational custom content with extension classes and an exact action label', () => {
    const child = <p data-kind="custom">Custom content</p>;
    const tree = Modal({
      title: 'Information',
      children: child,
      onClose: vi.fn(),
      variant: 'info',
      className: 'special-modal',
      bodyClassName: 'special-modal__body',
      actionLabel: 'Done',
    });

    expect(findElement(tree, (element) => element.type === 'h2').props).toMatchObject({
      className: 'modal__title modal__title--info',
      children: 'Information',
    });
    expect(findElement(tree, (element) => element.props.className === 'modal special-modal').props.className).toBe(
      'modal special-modal',
    );
    expect(
      findElement(tree, (element) => element.props.className === 'modal__body special-modal__body').props.children,
    ).toBe(child);
    expect(findElements(tree, (element) => element.type === 'button')[1].props.children).toBe('Done');
    expect(findElements(tree, (element) => element.props.className === 'modal__message')).toEqual([]);
  });
});
