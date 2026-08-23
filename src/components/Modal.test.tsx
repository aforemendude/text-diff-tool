import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('opens the native dialog on mount, closes it on unmount, and restores the prior focus', () => {
    class TestHTMLElement {
      focus = vi.fn();
    }

    const previouslyFocused = new TestHTMLElement();
    const dialog = {
      open: false,
      showModal: vi.fn(() => {
        dialog.open = true;
      }),
      close: vi.fn(() => {
        dialog.open = false;
      }),
    } as unknown as HTMLDialogElement;
    let cleanup: (() => void) | undefined;
    vi.stubGlobal('HTMLElement', TestHTMLElement);
    vi.stubGlobal('document', { activeElement: previouslyFocused });
    reactMocks.useRef.mockReturnValue({ current: dialog });
    reactMocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
      cleanup = effect() ?? undefined;
    });

    Modal({ title: 'Information', message: 'Details', onClose: vi.fn() });

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(cleanup).toBeTypeOf('function');
    cleanup?.();
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(previouslyFocused.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  it('contains Tab focus in the enabled dialog controls and focuses the dialog when none exist', () => {
    const disabled = { hasAttribute: vi.fn((name: string) => name === 'disabled'), focus: vi.fn() };
    const first = { hasAttribute: vi.fn(() => false), focus: vi.fn() };
    const middle = { hasAttribute: vi.fn(() => false), focus: vi.fn() };
    const last = { hasAttribute: vi.fn(() => false), focus: vi.fn() };
    const focusableElements = [disabled, first, middle, last];
    const dialog = {
      querySelectorAll: vi.fn(() => focusableElements),
      contains: vi.fn((element: unknown) => focusableElements.includes(element as (typeof focusableElements)[number])),
      focus: vi.fn(),
    } as unknown as HTMLDialogElement;
    const documentState: { activeElement: unknown } = { activeElement: first };
    vi.stubGlobal('document', documentState);
    reactMocks.useRef.mockReturnValue({ current: dialog });
    const tree = Modal({ title: 'Information', message: 'Details', onClose: vi.fn() });
    const keyDown = tree.props.onKeyDown as (event: {
      key: string;
      shiftKey: boolean;
      preventDefault: () => void;
    }) => void;

    const backwardPreventDefault = vi.fn();
    keyDown({ key: 'Tab', shiftKey: true, preventDefault: backwardPreventDefault });
    expect(backwardPreventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();
    expect(disabled.focus).not.toHaveBeenCalled();

    documentState.activeElement = last;
    const forwardPreventDefault = vi.fn();
    keyDown({ key: 'Tab', shiftKey: false, preventDefault: forwardPreventDefault });
    expect(forwardPreventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();

    documentState.activeElement = {};
    const outsidePreventDefault = vi.fn();
    keyDown({ key: 'Tab', shiftKey: false, preventDefault: outsidePreventDefault });
    expect(outsidePreventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledTimes(2);

    documentState.activeElement = middle;
    const middlePreventDefault = vi.fn();
    keyDown({ key: 'Tab', shiftKey: false, preventDefault: middlePreventDefault });
    expect(middlePreventDefault).not.toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalledTimes(2);
    expect(last.focus).toHaveBeenCalledOnce();

    dialog.querySelectorAll = vi.fn(() => []) as unknown as typeof dialog.querySelectorAll;
    const emptyPreventDefault = vi.fn();
    keyDown({ key: 'Tab', shiftKey: false, preventDefault: emptyPreventDefault });
    expect(emptyPreventDefault).toHaveBeenCalledOnce();
    expect(dialog.focus).toHaveBeenCalledOnce();
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
