import { describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from '../test/reactElements';
import AboutModal from './AboutModal';
import Modal from './Modal';

describe('AboutModal', () => {
  it('composes the shared Modal shell with its owned semantic content', () => {
    const onClose = vi.fn();
    const tree = AboutModal({ onClose });

    expect(tree.type).toBe(Modal);
    expect(tree.props).toMatchObject({
      title: 'About TextDiffTool',
      onClose,
      variant: 'info',
      className: 'about-modal',
      bodyClassName: 'about-modal__body',
      actionLabel: 'Close',
    });

    expect(findElement(tree, (element) => element.type === 'img').props).toMatchObject({
      src: '/text-diff-tool/logo.svg',
      alt: 'TextDiffTool Logo',
      className: 'about-modal__logo-img',
    });
    expect(findElements(tree, (element) => element.type === 'h3').map((element) => element.props.children)).toEqual([
      'Features',
      'Privacy',
    ]);
    expect(findElement(tree, (element) => element.type === 'a').props).toMatchObject({
      href: 'https://github.com/aforemendude/text-diff-tool',
      target: '_blank',
      rel: 'noopener noreferrer',
      children: 'View on GitHub',
    });
  });
});
