import type { DiffAlgorithm, DiffCleanupMode, DiffMode } from './diff/types';

export interface DiffSettings {
  diffMode: DiffMode;
  diffAlgorithm: DiffAlgorithm;
  diffCleanupMode: DiffCleanupMode;
  editCost: number;
  showTextDecorations: boolean;
}

export const DEFAULT_DIFF_SETTINGS: Readonly<DiffSettings> = {
  diffMode: 'line-grapheme',
  diffAlgorithm: 'myers',
  diffCleanupMode: 'none',
  editCost: 4,
  showTextDecorations: true,
};

export const DIFF_SETTINGS_STORAGE_KEY = 'text-diff-tool.settings.v1';

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

function resolveStorage(storage?: SettingsStorage): SettingsStorage | undefined {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDiffMode(value: unknown): value is DiffMode {
  return value === 'line-grapheme' || value === 'grapheme';
}

function isDiffAlgorithm(value: unknown): value is DiffAlgorithm {
  return value === 'myers' || value === 'adaptive';
}

function isDiffCleanupMode(value: unknown): value is DiffCleanupMode {
  return value === 'none' || value === 'semantic' || value === 'efficiency';
}

export function loadDiffSettings(storage?: SettingsStorage): DiffSettings {
  const defaults = { ...DEFAULT_DIFF_SETTINGS };

  try {
    const storedValue = resolveStorage(storage)?.getItem(DIFF_SETTINGS_STORAGE_KEY);
    if (storedValue === undefined || storedValue === null) {
      return defaults;
    }

    const parsed: unknown = JSON.parse(storedValue);
    if (!isRecord(parsed)) {
      return defaults;
    }

    return {
      diffMode: isDiffMode(parsed['diffMode']) ? parsed['diffMode'] : defaults.diffMode,
      diffAlgorithm: isDiffAlgorithm(parsed['diffAlgorithm']) ? parsed['diffAlgorithm'] : defaults.diffAlgorithm,
      diffCleanupMode: isDiffCleanupMode(parsed['diffCleanupMode'])
        ? parsed['diffCleanupMode']
        : defaults.diffCleanupMode,
      editCost:
        typeof parsed['editCost'] === 'number' && Number.isFinite(parsed['editCost']) && parsed['editCost'] >= 0
          ? parsed['editCost']
          : defaults.editCost,
      showTextDecorations:
        typeof parsed['showTextDecorations'] === 'boolean'
          ? parsed['showTextDecorations']
          : defaults.showTextDecorations,
    };
  } catch {
    return defaults;
  }
}

export function saveDiffSettings(settings: DiffSettings, storage?: SettingsStorage): boolean {
  try {
    const resolvedStorage = resolveStorage(storage);
    if (resolvedStorage === undefined) {
      return false;
    }

    resolvedStorage.setItem(DIFF_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
