import { describe, it, expect } from 'vitest';
import { stringifyWithSortedKeys } from './jsonUtils';

describe('stringifyWithSortedKeys', () => {
  describe('primitive values', () => {
    it('handles null', () => {
      expect(stringifyWithSortedKeys(null)).toBe('null');
    });

    it('handles undefined', () => {
      // JSON.stringify converts undefined to undefined (not a string)
      expect(stringifyWithSortedKeys(undefined)).toBeUndefined();
    });

    it('handles numbers', () => {
      expect(stringifyWithSortedKeys(42)).toBe('42');
      expect(stringifyWithSortedKeys(3.14)).toBe('3.14');
      expect(stringifyWithSortedKeys(-100)).toBe('-100');
    });

    it('handles strings', () => {
      expect(stringifyWithSortedKeys('hello')).toBe('"hello"');
      expect(stringifyWithSortedKeys('')).toBe('""');
    });

    it('handles booleans', () => {
      expect(stringifyWithSortedKeys(true)).toBe('true');
      expect(stringifyWithSortedKeys(false)).toBe('false');
    });
  });

  describe('simple objects', () => {
    it('handles empty objects', () => {
      expect(stringifyWithSortedKeys({})).toBe('{}');
    });

    it('handles single key objects', () => {
      const result = stringifyWithSortedKeys({ name: 'test' });
      expect(result).toBe('{\n  "name": "test"\n}');
    });

    it('sorts keys alphabetically', () => {
      const input = { zebra: 1, apple: 2, mango: 3 };
      const result = stringifyWithSortedKeys(input);
      const expected = `{
  "apple": 2,
  "mango": 3,
  "zebra": 1
}`;
      expect(result).toBe(expected);
    });

    it('produces identical output for objects with same keys in different order', () => {
      const obj1 = { b: 2, a: 1, c: 3 };
      const obj2 = { a: 1, c: 3, b: 2 };
      const obj3 = { c: 3, b: 2, a: 1 };

      const result1 = stringifyWithSortedKeys(obj1);
      const result2 = stringifyWithSortedKeys(obj2);
      const result3 = stringifyWithSortedKeys(obj3);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('nested objects', () => {
    it('sorts keys in nested objects', () => {
      const input = {
        outer: {
          z: 1,
          a: 2,
        },
        inner: 'value',
      };
      const result = stringifyWithSortedKeys(input);
      const expected = `{
  "inner": "value",
  "outer": {
    "a": 2,
    "z": 1
  }
}`;
      expect(result).toBe(expected);
    });

    it('handles deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              z: 'deep',
              a: 'value',
            },
          },
        },
      };
      const result = stringifyWithSortedKeys(input);
      expect(result).toContain('"a": "value"');
      expect(result).toContain('"z": "deep"');
      // Check that 'a' comes before 'z' in the output
      expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"z"'));
    });
  });

  describe('arrays', () => {
    it('handles empty arrays', () => {
      expect(stringifyWithSortedKeys([])).toBe('[]');
    });

    it('handles arrays with primitive values', () => {
      const result = stringifyWithSortedKeys([1, 2, 3]);
      const expected = `[
  1,
  2,
  3
]`;
      expect(result).toBe(expected);
    });

    it('preserves array order (does not sort array elements)', () => {
      const input = [3, 1, 2];
      const result = stringifyWithSortedKeys(input);
      const expected = `[
  3,
  1,
  2
]`;
      expect(result).toBe(expected);
    });

    it('handles arrays of objects with sorted keys', () => {
      const input = [
        { z: 1, a: 2 },
        { y: 3, b: 4 },
      ];
      const result = stringifyWithSortedKeys(input);
      // Keys should be sorted within each object
      const expected = `[
  {
    "a": 2,
    "z": 1
  },
  {
    "b": 4,
    "y": 3
  }
]`;
      expect(result).toBe(expected);
    });

    it('handles nested arrays', () => {
      const input = [
        [1, 2],
        [3, 4],
      ];
      const result = stringifyWithSortedKeys(input);
      const expected = `[
  [
    1,
    2
  ],
  [
    3,
    4
  ]
]`;
      expect(result).toBe(expected);
    });
  });

  describe('mixed structures', () => {
    it('handles objects containing arrays', () => {
      const input = {
        names: ['alice', 'bob'],
        count: 2,
      };
      const result = stringifyWithSortedKeys(input);
      // 'count' should come before 'names' alphabetically
      expect(result.indexOf('"count"')).toBeLessThan(result.indexOf('"names"'));
    });

    it('handles complex nested structures', () => {
      const input = {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        metadata: {
          version: 1,
          created: '2024-01-01',
        },
      };
      const result = stringifyWithSortedKeys(input);

      // 'metadata' should come before 'users'
      expect(result.indexOf('"metadata"')).toBeLessThan(
        result.indexOf('"users"'),
      );

      // Within metadata, 'created' should come before 'version'
      expect(result.indexOf('"created"')).toBeLessThan(
        result.indexOf('"version"'),
      );

      // Within user objects, 'age' should come before 'name'
      expect(result.indexOf('"age"')).toBeLessThan(result.indexOf('"name"'));
    });
  });

  describe('special cases', () => {
    it('handles objects with numeric string keys', () => {
      const input = { '2': 'two', '1': 'one', '10': 'ten' };
      const result = stringifyWithSortedKeys(input);
      // Numeric strings are sorted as strings, so '1' < '10' < '2'
      const pos1 = result.indexOf('"1"');
      const pos10 = result.indexOf('"10"');
      const pos2 = result.indexOf('"2"');
      expect(pos1).toBeLessThan(pos10);
      expect(pos10).toBeLessThan(pos2);
    });

    it('handles objects with special characters in keys', () => {
      const input = { 'key-with-dash': 1, 'key.with.dots': 2 };
      const result = stringifyWithSortedKeys(input);
      expect(result).toContain('"key-with-dash"');
      expect(result).toContain('"key.with.dots"');
    });

    it('handles null values in objects', () => {
      const input = { a: null, b: 'value' };
      const result = stringifyWithSortedKeys(input);
      expect(result).toContain('"a": null');
    });

    it('handles empty string keys', () => {
      const input = { '': 'empty key', normal: 'value' };
      const result = stringifyWithSortedKeys(input);
      expect(result).toContain('"": "empty key"');
    });
  });

  describe('consistent output for comparison', () => {
    it('produces identical output for semantically equal objects', () => {
      // This is the main use case - ensuring two JSON objects that are
      // semantically identical but formatted differently produce the same output
      const json1 = JSON.parse('{"name":"test","value":123}');
      const json2 = JSON.parse('{"value":123,"name":"test"}');

      expect(stringifyWithSortedKeys(json1)).toBe(
        stringifyWithSortedKeys(json2),
      );
    });

    it('produces different output for semantically different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };

      expect(stringifyWithSortedKeys(obj1)).not.toBe(
        stringifyWithSortedKeys(obj2),
      );
    });
  });

  it('handles __proto__ key safely', () => {
    // This tests the safeDeepCopy function's main purpose
    const input = JSON.parse(`{
        "__proto__": "value1",
        "normal": "value2"
      }`);
    const result = stringifyWithSortedKeys(input);
    const expected = `{
  "__proto__": "value1",
  "normal": "value2"
}`;
    expect(result).toBe(expected);
  });
});
