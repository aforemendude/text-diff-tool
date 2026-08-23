import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DIFF_SETTINGS,
  DIFF_SETTINGS_STORAGE_KEY,
  loadDiffSettings,
  saveDiffSettings,
  type DiffSettings,
} from './settings';

function createStorage(storedValue: string | null = null) {
  return {
    getItem: vi.fn(() => storedValue),
    setItem: vi.fn(),
  };
}

describe('diff settings storage', () => {
  it('uses defaults when no saved settings are available', () => {
    const storage = createStorage();

    const settings = loadDiffSettings(storage);

    expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(DIFF_SETTINGS_STORAGE_KEY);
    expect(settings).toEqual(DEFAULT_DIFF_SETTINGS);
    expect(settings).not.toBe(DEFAULT_DIFF_SETTINGS);
  });

  it('saves and restores every setting', () => {
    const settings: DiffSettings = {
      diffMode: 'grapheme',
      diffAlgorithm: 'adaptive',
      diffCleanupMode: 'efficiency',
      editCost: 7.5,
      showTextDecorations: false,
    };
    const storage = createStorage();

    expect(saveDiffSettings(settings, storage)).toBe(true);

    const serializedSettings = storage.setItem.mock.calls[0]?.[1];
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(DIFF_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    expect(loadDiffSettings(createStorage(serializedSettings ?? null))).toEqual(settings);
  });

  it('keeps valid saved fields and falls back per field for invalid data', () => {
    const storage = createStorage(
      JSON.stringify({
        diffMode: 'unsupported',
        diffAlgorithm: 'adaptive',
        diffCleanupMode: 'semantic',
        editCost: -1,
        showTextDecorations: false,
      }),
    );

    expect(loadDiffSettings(storage)).toEqual({
      diffMode: DEFAULT_DIFF_SETTINGS.diffMode,
      diffAlgorithm: 'adaptive',
      diffCleanupMode: 'semantic',
      editCost: DEFAULT_DIFF_SETTINGS.editCost,
      showTextDecorations: false,
    });
  });

  it.each(['not JSON', 'null', '[]'])('uses defaults for an invalid stored payload: %s', (storedValue) => {
    expect(loadDiffSettings(createStorage(storedValue))).toEqual(DEFAULT_DIFF_SETTINGS);
  });

  it('handles unavailable browser storage without breaking the application', () => {
    const unavailableStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };

    expect(loadDiffSettings(unavailableStorage)).toEqual(DEFAULT_DIFF_SETTINGS);
    expect(saveDiffSettings({ ...DEFAULT_DIFF_SETTINGS }, unavailableStorage)).toBe(false);
  });
});
