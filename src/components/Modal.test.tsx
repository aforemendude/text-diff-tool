import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from '../test/reactElements';
import Modal from './Modal';

const reactMocks = vi.hoisted(() => ({
  useEffect: vi.fn(),
  useId: vi.fn(),
  useRef: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: reactMocks.useEffect,
  useId: reactMocks.useId,
  useRef: reactMocks.useRef,
}));

describe('Modal', () => {
  beforeEach(() => {
    reactMocks.useEffect.mockReset();
    reactMocks.useEffect.mockImplementation(() => undefined);
    reactMocks.useId.mockReset();
    reactMocks.useId.mockReturnValueOnce('modal-title').mockReturnValueOnce('modal-message');
    reactMocks.useRef.mockReset();
    reactMocks.useRef.mockReturnValue({ current: null });
  });

  it('renders the default error message contract and closes from every exposed control', () => {
    const onClose = vi.fn();
    const tree = Modal({ title: 'Failure', message: 'Something failed', onClose });

    expect(tree.type).toBe('dialog');
    expect(tree.props).toMatchObject({
      className: 'modal__overlay',
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-message',
    });
    const modal = findElement(tree, (element) => element.props.className === 'modal');
    const title = findElement(tree, (element) => element.type === 'h2');
    const message = findElement(tree, (element) => element.props.className === 'modal__message');
    const buttons = findElements(tree, (element) => element.type === 'button');

    expect(title.props).toMatchObject({ id: 'modal-title', className: 'modal__title', children: 'Failure' });
    expect(message.props).toMatchObject({ id: 'modal-message', children: 'Something failed' });
    expect(buttons.map((button) => button.props.children)).toEqual(['×', 'OK']);
    expect(buttons.map((button) => button.props.type)).toEqual(['button', 'button']);
    expect(buttons[0].props.autoFocus).toBe(true);
    expect(reactMocks.useEffect).toHaveBeenCalledWith(expect.any(Function), []);

    const backdrop = {};
    (tree.props.onClick as (event: { target: object; currentTarget: object }) => void)({
      target: backdrop,
      currentTarget: backdrop,
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const preventDefault = vi.fn();
    (tree.props.onCancel as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(2);

    (buttons[0].props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(3);
    (buttons[1].props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(4);

    const stopPropagation = vi.fn();
    (modal.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();

    (tree.props.onClick as (event: { target: object; currentTarget: object }) => void)({
      target: {},
      currentTarget: {},
    });
    expect(onClose).toHaveBeenCalledTimes(4);
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
      ariaDescribedBy: 'custom-description',
    });

    expect(tree.props['aria-describedby']).toBe('custom-description');
    expect(findElement(tree, (element) => element.type === 'h2').props).toMatchObject({
      id: 'modal-title',
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

  it('keeps a non-dismissible modal open until its dedicated action is used', () => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    const tree = Modal({
      title: 'Comparing Text',
      message: 'The comparison is still running.',
      onClose,
      onAction,
      actionLabel: 'Terminate',
      dismissible: false,
    });

    const buttons = findElements(tree, (element) => element.type === 'button');

    expect(tree.type).toBe('dialog');
    expect(tree.props).toMatchObject({
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-message',
    });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props).toMatchObject({
      type: 'button',
      className: 'btn btn-primary',
      children: 'Terminate',
      onClick: onAction,
      autoFocus: true,
    });
    expect(findElements(tree, (element) => element.props.className === 'modal__close')).toEqual([]);

    const backdrop = {};
    (tree.props.onClick as (event: { target: object; currentTarget: object }) => void)({
      target: backdrop,
      currentTarget: backdrop,
    });
    const preventDefault = vi.fn();
    (tree.props.onCancel as (event: { preventDefault: () => void }) => void)({ preventDefault });
    (buttons[0].props.onClick as () => void)();

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});
