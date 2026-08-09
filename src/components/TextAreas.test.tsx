import { describe, expect, it, vi } from 'vitest';
import { findElements } from '../test/reactElements';
import TextAreas from './TextAreas';

describe('TextAreas', () => {
  it('owns two distinctly labelled controlled text areas', () => {
    const tree = TextAreas({
      originalText: 'original value',
      modifiedText: 'modified value',
      onOriginalChange: vi.fn(),
      onModifiedChange: vi.fn(),
    });

    expect(tree.props.className).toBe('text-areas');
    expect(findElements(tree, (element) => element.type === 'h2').map((element) => element.props.children)).toEqual([
      'Original',
      'Modified',
    ]);
    expect(
      findElements(tree, (element) => element.type === 'textarea').map((element) => ({
        id: element.props.id,
        className: element.props.className,
        placeholder: element.props.placeholder,
        value: element.props.value,
      })),
    ).toEqual([
      {
        id: 'original',
        className: 'text-areas__textarea',
        placeholder: 'Paste the original version of the text here...',
        value: 'original value',
      },
      {
        id: 'modified',
        className: 'text-areas__textarea',
        placeholder: 'Paste the modified version of the text here...',
        value: 'modified value',
      },
    ]);
  });

  it('routes each field change only to its owning callback', () => {
    const onOriginalChange = vi.fn();
    const onModifiedChange = vi.fn();
    const tree = TextAreas({ originalText: '', modifiedText: '', onOriginalChange, onModifiedChange });
    const textareas = findElements(tree, (element) => element.type === 'textarea');

    (textareas[0].props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: 'new original' },
    });
    expect(onOriginalChange).toHaveBeenCalledExactlyOnceWith('new original');
    expect(onModifiedChange).not.toHaveBeenCalled();

    (textareas[1].props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: 'new modified' },
    });
    expect(onModifiedChange).toHaveBeenCalledExactlyOnceWith('new modified');
    expect(onOriginalChange).toHaveBeenCalledTimes(1);
  });
});
