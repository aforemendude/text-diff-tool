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
    expect(findElements(tree, (element) => element.type === 'a').map((element) => element.props)).toEqual([
      expect.objectContaining({
        href: 'https://github.com/aforemendude/text-diff-tool',
        target: '_blank',
        rel: 'noopener noreferrer',
        children: 'View on GitHub',
      }),
      expect.objectContaining({
        href: expect.stringMatching(/\/fonts\/inter\/OFL\.txt$/),
        target: '_blank',
        rel: 'noopener noreferrer',
        children: 'Inter license',
      }),
      expect.objectContaining({
        href: expect.stringMatching(/\/fonts\/jetbrains-mono\/OFL\.txt$/),
        target: '_blank',
        rel: 'noopener noreferrer',
        children: 'JetBrains Mono license',
      }),
      expect.objectContaining({
        href: expect.stringMatching(/\/THIRD_PARTY_NOTICES\.txt$/),
        target: '_blank',
        rel: 'noopener noreferrer',
        children: 'Runtime library licenses and notices',
      }),
    ]);
  });
});
