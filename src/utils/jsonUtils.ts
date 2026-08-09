const isObject = (value: unknown): value is object => value !== null && typeof value === 'object';

const isEnumerableStringKey = (value: object, key: string | symbol): key is string => {
  return typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key);
};

const getOrderedOwnKeys = (value: object): (string | symbol)[] => {
  const ownKeys = Reflect.ownKeys(value);
  const orderedJsonKeys = ownKeys.filter((key) => isEnumerableStringKey(value, key)).sort();
  const otherKeys = ownKeys.filter((key) => !isEnumerableStringKey(value, key));

  // Include non-enumerable and symbol keys to satisfy Proxy invariants. JSON.stringify ignores them.
  return [...orderedJsonKeys, ...otherKeys];
};

/** Stringifies a value with sorted keys for consistent JSON comparison. */
export function stringifyWithSortedKeys(value: unknown): string {
  const proxyCache = new WeakMap<object, object>();

  const getSortingProxy = (currentValue: object): object => {
    const cachedProxy = proxyCache.get(currentValue);
    if (cachedProxy !== undefined) {
      return cachedProxy;
    }

    const handler: ProxyHandler<object> = {
      // Accessors should receive the original object, as they do with JSON.stringify(value).
      get: (target, key) => Reflect.get(target, key, target),
    };

    if (!Array.isArray(currentValue)) {
      handler.ownKeys = (target) => getOrderedOwnKeys(target);
    }

    const proxy = new Proxy(currentValue, handler);
    proxyCache.set(currentValue, proxy);
    return proxy;
  };

  // Wrap each value only when JSON.stringify reaches it, avoiding a cloned object graph and a global replacer key list.
  return JSON.stringify(
    value,
    (_key: string, currentValue: unknown): unknown =>
      isObject(currentValue) ? getSortingProxy(currentValue) : currentValue,
    2,
  );
}

export interface JsonIssueCounts {
  numericPrecision: number;
  duplicateKeys: number;
}

interface CanonicalDecimal {
  digits: string;
  exponent: number;
  isNegative: boolean;
}

const JSON_NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const JSON_NUMBER_PARTS_PATTERN = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

/**
 * Converts a JSON number token into a normalized base-10 representation so numerically equivalent spellings such as 1e2
 * and 100 can be compared.
 */
function canonicalizeDecimal(token: string): CanonicalDecimal | null {
  const match = JSON_NUMBER_PARTS_PATTERN.exec(token);
  if (!match) {
    return null;
  }

  const fraction = match[3] ?? '';
  let digits = `${match[2]}${fraction}`.replace(/^0+/, '');
  if (digits === '') {
    return { digits: '0', exponent: 0, isNegative: false };
  }

  const explicitExponent = Number(match[4] ?? '0');
  if (!Number.isSafeInteger(explicitExponent)) {
    return null;
  }

  let trailingZeroCount = 0;
  while (digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    trailingZeroCount++;
  }

  const exponent = explicitExponent - fraction.length + trailingZeroCount;
  if (!Number.isSafeInteger(exponent)) {
    return null;
  }

  return { digits, exponent, isNegative: match[1] === '-' };
}

function hasNumericPrecisionIssue(token: string): boolean {
  const parsedNumber = Number(token);
  if (!Number.isFinite(parsedNumber)) {
    return true;
  }

  // Unsafe integers can collide with adjacent JSON integer values even when their shortest decimal rendering happens to
  // match the source token.
  if (Number.isInteger(parsedNumber) && !Number.isSafeInteger(parsedNumber)) {
    return true;
  }

  const sourceValue = canonicalizeDecimal(token);
  const parsedValue = canonicalizeDecimal(parsedNumber.toString());
  return (
    sourceValue === null ||
    parsedValue === null ||
    sourceValue.digits !== parsedValue.digits ||
    sourceValue.exponent !== parsedValue.exponent ||
    sourceValue.isNegative !== parsedValue.isNegative
  );
}

/**
 * Scans already-valid JSON while retaining source tokens that JSON.parse discards. A small recursive scanner is used
 * because duplicate object keys and the original spelling of numbers cannot be recovered from the parsed value.
 */
class JsonIssueScanner {
  private position = 0;
  private readonly counts: JsonIssueCounts = { numericPrecision: 0, duplicateKeys: 0 };

  constructor(private readonly text: string) {}

  scan(): JsonIssueCounts {
    this.skipWhitespace();
    this.scanValue();
    return this.counts;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.text[this.position] ?? '')) {
      this.position++;
    }
  }

  private scanValue(): void {
    this.skipWhitespace();

    const character = this.text[this.position];
    if (character === '{') {
      this.scanObject();
      return;
    }
    if (character === '[') {
      this.scanArray();
      return;
    }
    if (character === '"') {
      this.scanString();
      return;
    }
    if (character === 't') {
      this.position += 4;
      return;
    }
    if (character === 'f') {
      this.position += 5;
      return;
    }
    if (character === 'n') {
      this.position += 4;
      return;
    }

    JSON_NUMBER_PATTERN.lastIndex = this.position;
    const match = JSON_NUMBER_PATTERN.exec(this.text);
    if (!match) {
      throw new Error('Unable to scan a JSON value that was parsed successfully.');
    }
    if (hasNumericPrecisionIssue(match[0])) {
      this.counts.numericPrecision++;
    }
    this.position = JSON_NUMBER_PATTERN.lastIndex;
  }

  private scanObject(): void {
    this.position++;
    this.skipWhitespace();
    const keys = new Set<string>();

    if (this.text[this.position] === '}') {
      this.position++;
      return;
    }

    while (true) {
      const key = this.scanString();
      if (keys.has(key)) {
        this.counts.duplicateKeys++;
      } else {
        keys.add(key);
      }

      this.skipWhitespace();
      this.position++;
      this.scanValue();
      this.skipWhitespace();

      if (this.text[this.position] === '}') {
        this.position++;
        return;
      }
      this.position++;
      this.skipWhitespace();
    }
  }

  private scanArray(): void {
    this.position++;
    this.skipWhitespace();

    if (this.text[this.position] === ']') {
      this.position++;
      return;
    }

    while (true) {
      this.scanValue();
      this.skipWhitespace();

      if (this.text[this.position] === ']') {
        this.position++;
        return;
      }
      this.position++;
      this.skipWhitespace();
    }
  }

  private scanString(): string {
    const start = this.position;
    this.position++;

    while (this.position < this.text.length) {
      const character = this.text[this.position++];
      if (character === '\\') {
        this.position++;
      } else if (character === '"') {
        return JSON.parse(this.text.slice(start, this.position)) as string;
      }
    }

    throw new Error('Unable to scan a JSON string that was parsed successfully.');
  }
}

/**
 * Counts lossy number conversions and repeated keys in valid JSON text. Every occurrence of a key after the first
 * within the same object is counted as a duplicate.
 */
export function detectJsonIssues(text: string): JsonIssueCounts {
  return new JsonIssueScanner(text).scan();
}
