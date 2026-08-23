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
      ariaDescribedBy: 'about-modal-description',
    });

    expect(findElement(tree, (element) => element.type === 'img').props).toMatchObject({
      src: '/text-diff-tool/logo.svg',
      alt: '',
      className: 'about-modal__logo-img',
    });
    expect(findElement(tree, (element) => element.props.id === 'about-modal-description').props).toMatchObject({
      className: 'about-modal__description',
      children:
        'A modern, browser-based tool for comparing text and visualizing differences with character-level precision.',
    });
    expect(findElements(tree, (element) => element.type === 'h3').map((element) => element.props.children)).toEqual([
      'Features',
      'Privacy',
    ]);
    expect(findElements(tree, (element) => element.type === 'ul').map((element) => element.props.role)).toEqual([
      'list',
      'list',
    ]);
    expect(
      findElements(tree, (element) => element.props.className === 'about-modal__check').map(
        (check) => check.props['aria-hidden'],
      ),
    ).toEqual(['true', 'true', 'true', 'true', 'true', 'true', 'true']);
    expect(findElements(tree, (element) => element.type === 'a').map((element) => element.props)).toEqual([
      expect.objectContaining({
        href: 'https://github.com/aforemendude/text-diff-tool',
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'View on GitHub (opens in a new tab)',
        children: 'View on GitHub',
      }),
      expect.objectContaining({
        href: '/text-diff-tool/fonts/inter/OFL.txt',
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'Inter license (opens in a new tab)',
        children: 'Inter license',
      }),
      expect.objectContaining({
        href: '/text-diff-tool/fonts/jetbrains-mono/OFL.txt',
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'JetBrains Mono license (opens in a new tab)',
        children: 'JetBrains Mono license',
      }),
      expect.objectContaining({
        href: '/text-diff-tool/THIRD_PARTY_NOTICES.txt',
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'Runtime library licenses and notices (opens in a new tab)',
        children: 'Runtime library licenses and notices',
      }),
    ]);
  });
});
