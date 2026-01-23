/**
 * Traverses an object and collects all keys (including nested ones) into a
 * sorted array.
 *
 * For arrays, it adds the index as a string.
 */
function collectSortedKeys(value: unknown): string[] {
  const keys: Set<string> = new Set();

  function traverse(obj: unknown): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        keys.add(i.toString());
        traverse(obj[i]);
      }
      return;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        keys.add(key);
        traverse((obj as Record<string, unknown>)[key]);
      }
    }
  }

  traverse(value);
  return Array.from(keys).sort();
}

/**
 * Deep copies an object into a structure where all objects are created with
 * Object.create(null) and all arrays are converted to objects with index keys.
 *
 * This is needed to ensure safe handling of JSON objects that have "__proto__"
 * as a key.
 */
function safeDeepCopy(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const result = Object.create(null);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = safeDeepCopy((obj as any)[key]);
    }
  }

  return result;
}

/**
 * Stringifies a value with sorted keys for consistent JSON comparison.
 */
export function stringifyWithSortedKeys(value: unknown): string {
  const sortedKeys = collectSortedKeys(value);
  return JSON.stringify(safeDeepCopy(value), sortedKeys, 2);
}
