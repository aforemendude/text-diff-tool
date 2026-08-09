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
      const expected = `{
  "a": 1,
  "b": 2,
  "c": 3
}`;

      expect([result1, result2, result3]).toEqual([expected, expected, expected]);
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
      const expected = `{
  "level1": {
    "level2": {
      "level3": {
        "a": "value",
        "z": "deep"
      }
    }
  }
}`;
      expect(result).toBe(expected);
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
      const expected = `{
  "count": 2,
  "names": [
    "alice",
    "bob"
  ]
}`;
      expect(result).toBe(expected);
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
      const expected = `{
  "metadata": {
    "created": "2024-01-01",
    "version": 1
  },
  "users": [
    {
      "age": 30,
      "name": "Alice"
    },
    {
      "age": 25,
      "name": "Bob"
    }
  ]
}`;
      expect(result).toBe(expected);
    });
  });

  describe('special cases', () => {
    it('handles objects with numeric string keys', () => {
      const input = { '2': 'two', '1': 'one', '10': 'ten' };
      const result = stringifyWithSortedKeys(input);
      const expected = `{
  "1": "one",
  "10": "ten",
  "2": "two"
}`;
      expect(result).toBe(expected);
    });

    it('handles objects with special characters in keys', () => {
      const input = { 'key-with-dash': 1, 'key.with.dots': 2 };
      const result = stringifyWithSortedKeys(input);
      const expected = `{
  "key-with-dash": 1,
  "key.with.dots": 2
}`;
      expect(result).toBe(expected);
    });

    it('handles null values in objects', () => {
      const input = { a: null, b: 'value' };
      const result = stringifyWithSortedKeys(input);
      const expected = `{
  "a": null,
  "b": "value"
}`;
      expect(result).toBe(expected);
    });

    it('handles empty string keys', () => {
      const input = { '': 'empty key', normal: 'value' };
      const result = stringifyWithSortedKeys(input);
      const expected = `{
  "": "empty key",
  "normal": "value"
}`;
      expect(result).toBe(expected);
    });
  });

  describe('consistent output for comparison', () => {
    it('produces identical output for semantically equal objects', () => {
      // This is the main use case - ensuring two JSON objects that are semantically identical but formatted differently
      // produce the same output
      const json1 = JSON.parse('{"name":"test","value":123}');
      const json2 = JSON.parse('{"value":123,"name":"test"}');
      const expected = `{
  "name": "test",
  "value": 123
}`;

      expect([stringifyWithSortedKeys(json1), stringifyWithSortedKeys(json2)]).toEqual([expected, expected]);
    });

    it('produces different output for semantically different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };

      expect([stringifyWithSortedKeys(obj1), stringifyWithSortedKeys(obj2)]).toEqual([
        `{
  "a": 1,
  "b": 2
}`,
        `{
  "a": 1,
  "b": 3
}`,
      ]);
    });
  });

  it('handles __proto__ key safely', () => {
    // This tests the safeDeepCopy function's main purpose
    const input = JSON.parse(`{
        "__proto__": { "polluted": true },
        "obj": {}
      }`);
    const result = stringifyWithSortedKeys(input);
    const expected = `{
  "__proto__": {
    "polluted": true
  },
  "obj": {}
}`;
    expect(result).toBe(expected);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('excludes inherited enumerable properties at every traversal stage', () => {
    const input = Object.assign(Object.create({ inherited: 'excluded' }), { own: 'included' });

    expect(stringifyWithSortedKeys(input)).toBe(`{
  "own": "included"
}`);
  });

  it('normalizes sparse and undefined array entries like JSON.stringify', () => {
    const input = [1, , undefined];

    expect(stringifyWithSortedKeys(input)).toBe(`[
  1,
  null,
  null
]`);
  });
});
