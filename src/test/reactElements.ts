import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

type ElementProps = Record<string, unknown> & { children?: ReactNode };

export type TestElement = ReactElement<ElementProps>;

export function findElements(node: ReactNode, predicate: (element: TestElement) => boolean): TestElement[] {
  const matches: TestElement[] = [];

  function visit(value: ReactNode): void {
    if (!isValidElement<ElementProps>(value)) {
      return;
    }

    if (predicate(value)) {
      matches.push(value);
    }

    Children.forEach(value.props.children, visit);
  }

  Children.forEach(node, visit);
  return matches;
}

export function findElement(node: ReactNode, predicate: (element: TestElement) => boolean): TestElement {
  const matches = findElements(node, predicate);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one matching React element, received ${matches.length}`);
  }
  return matches[0];
}
