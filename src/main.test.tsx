import React, { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn() }));

vi.mock('react-dom/client', () => ({
  default: { createRoot: rootMocks.createRoot },
}));

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    rootMocks.createRoot.mockReset();
    rootMocks.render.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies the prototype guard, mounts App, and reveals the top-level document', async () => {
    const appRoot = {} as HTMLElement;
    const body = { hidden: true, inert: true } as HTMLElement;
    const getElementById = vi.fn(() => appRoot);
    const topLevelWindow = {};
    vi.stubGlobal('window', { self: topLevelWindow, top: topLevelWindow });
    vi.stubGlobal('document', { body, getElementById });
    const freeze = vi.spyOn(Object, 'freeze').mockImplementation((value) => value as object);
    rootMocks.createRoot.mockReturnValue({ render: rootMocks.render });

    await import('./main');
    const { default: App } = await import('./App');

    expect(freeze.mock.calls.filter(([value]) => value === Object.prototype)).toHaveLength(1);
    expect(getElementById).toHaveBeenCalledExactlyOnceWith('app');
    expect(rootMocks.createRoot).toHaveBeenCalledExactlyOnceWith(appRoot);
    expect(rootMocks.render).toHaveBeenCalledOnce();

    const strictMode = rootMocks.render.mock.calls[0]?.[0];
    expect(isValidElement(strictMode)).toBe(true);
    if (!isValidElement<{ children: React.ReactElement }>(strictMode)) {
      throw new Error('Expected StrictMode to receive a React element');
    }
    expect(strictMode.type).toBe(React.StrictMode);
    expect(strictMode.props.children.type).toBe(App);
    expect(body).toMatchObject({ hidden: false, inert: false });
  });

  it('leaves a framed document hidden and does not mount the application', async () => {
    const body = { hidden: true, inert: true } as HTMLElement;
    const getElementById = vi.fn();
    vi.stubGlobal('window', { self: {}, top: {} });
    vi.stubGlobal('document', { body, getElementById });
    const freeze = vi.spyOn(Object, 'freeze').mockImplementation((value) => value as object);

    await import('./main');

    expect(freeze.mock.calls.filter(([value]) => value === Object.prototype)).toHaveLength(0);
    expect(getElementById).not.toHaveBeenCalled();
    expect(rootMocks.createRoot).not.toHaveBeenCalled();
    expect(rootMocks.render).not.toHaveBeenCalled();
    expect(body).toMatchObject({ hidden: true, inert: true });
  });
});
