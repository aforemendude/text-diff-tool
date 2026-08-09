import React, { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const rootMocks = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn() }));

vi.mock('react-dom/client', () => ({
  default: { createRoot: rootMocks.createRoot },
}));

describe('main', () => {
  beforeEach(() => {
    rootMocks.createRoot.mockReset();
    rootMocks.render.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies the prototype guard and mounts App in StrictMode at the owned root', async () => {
    const appRoot = {} as HTMLElement;
    const getElementById = vi.fn(() => appRoot);
    vi.stubGlobal('document', { getElementById });
    const freeze = vi.spyOn(Object, 'freeze').mockImplementation((value) => value as object);
    rootMocks.createRoot.mockReturnValue({ render: rootMocks.render });

    await import('./main');

    expect(freeze.mock.calls.filter(([value]) => value === Object.prototype)).toHaveLength(1);
    expect(getElementById).toHaveBeenCalledExactlyOnceWith('app');
    expect(rootMocks.createRoot).toHaveBeenCalledExactlyOnceWith(appRoot);
    expect(rootMocks.render).toHaveBeenCalledOnce();

    const strictMode = rootMocks.render.mock.calls[0][0];
    expect(isValidElement(strictMode)).toBe(true);
    if (!isValidElement<{ children: React.ReactElement }>(strictMode)) {
      throw new Error('Expected StrictMode to receive a React element');
    }
    expect(strictMode.type).toBe(React.StrictMode);
    expect(strictMode.props.children.type).toBe(App);
  });
});
