/**
 * Sequence diff adapted from Diff Match Patch.
 *
 * Copyright 2018 The diff-match-patch Authors. https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

export type LineDiffOperation = -1 | 0 | 1;

export interface LineSequenceDiff {
  operation: LineDiffOperation;
  lines: string[];
}

interface EncodedDiff {
  operation: LineDiffOperation;
  values: number[];
}

const DELETE = -1;
const INSERT = 1;
const EQUAL = 0;

/**
 * Diff complete lines without encoding their IDs as UTF-16 code units.
 *
 * Diff Match Patch's private line encoder stores each unique line in one code unit, which forces it to collapse the
 * remainder of sufficiently large inputs into a single token. Numeric arrays have no corresponding 40,000-line
 * boundary, while the sequence diff below retains the engine's Myers diff and cleanup behavior.
 */
export function diffLines(text1: string, text2: string): LineSequenceDiff[] {
  const lines1 = splitLines(text1);
  const lines2 = splitLines(text2);
  const lineIds = new Map<string, number>();
  const linesById: string[] = [];

  const encode = (lines: string[]): number[] =>
    lines.map((line) => {
      const existingId = lineIds.get(line);
      if (existingId !== undefined) {
        return existingId;
      }

      const id = linesById.length;
      lineIds.set(line, id);
      linesById.push(line);
      return id;
    });

  return diffSequences(encode(lines1), encode(lines2)).map(({ operation, values }) => ({
    operation,
    lines: values.map((value) => linesById[value]),
  }));
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let lineStart = 0;

  while (lineStart < text.length) {
    const newlineIndex = text.indexOf('\n', lineStart);
    if (newlineIndex === -1) {
      lines.push(text.slice(lineStart));
      break;
    }

    lines.push(text.slice(lineStart, newlineIndex + 1));
    lineStart = newlineIndex + 1;
  }

  return lines;
}

function diffSequences(values1: number[], values2: number[]): EncodedDiff[] {
  if (sequencesEqual(values1, values2)) {
    return values1.length === 0 ? [] : [{ operation: EQUAL, values: values1 }];
  }

  const prefixLength = commonPrefix(values1, values2);
  const prefix = values1.slice(0, prefixLength);
  values1 = values1.slice(prefixLength);
  values2 = values2.slice(prefixLength);

  const suffixLength = commonSuffix(values1, values2);
  const suffix = suffixLength === 0 ? [] : values1.slice(values1.length - suffixLength);
  if (suffixLength !== 0) {
    values1 = values1.slice(0, values1.length - suffixLength);
    values2 = values2.slice(0, values2.length - suffixLength);
  }

  const diffs = computeDiff(values1, values2);
  if (prefix.length !== 0) {
    diffs.unshift({ operation: EQUAL, values: prefix });
  }
  if (suffix.length !== 0) {
    diffs.push({ operation: EQUAL, values: suffix });
  }

  cleanupMerge(diffs);
  return diffs;
}

function computeDiff(values1: number[], values2: number[]): EncodedDiff[] {
  if (values1.length === 0) {
    return [{ operation: INSERT, values: values2 }];
  }
  if (values2.length === 0) {
    return [{ operation: DELETE, values: values1 }];
  }

  const firstIsLonger = values1.length > values2.length;
  const longValues = firstIsLonger ? values1 : values2;
  const shortValues = firstIsLonger ? values2 : values1;
  const shortIndex = indexOfSequence(longValues, shortValues);

  if (shortIndex !== -1) {
    const operation = firstIsLonger ? DELETE : INSERT;
    return [
      { operation, values: longValues.slice(0, shortIndex) },
      { operation: EQUAL, values: shortValues },
      { operation, values: longValues.slice(shortIndex + shortValues.length) },
    ];
  }

  if (shortValues.length === 1) {
    return [
      { operation: DELETE, values: values1 },
      { operation: INSERT, values: values2 },
    ];
  }

  return bisect(values1, values2);
}

function bisect(values1: number[], values2: number[]): EncodedDiff[] {
  const length1 = values1.length;
  const length2 = values2.length;
  const maxDistance = Math.ceil((length1 + length2) / 2);
  const vectorOffset = maxDistance;
  const vectorLength = 2 * maxDistance;
  const forward = new Int32Array(vectorLength);
  const reverse = new Int32Array(vectorLength);
  forward.fill(-1);
  reverse.fill(-1);
  forward[vectorOffset + 1] = 0;
  reverse[vectorOffset + 1] = 0;

  const delta = length1 - length2;
  const front = delta % 2 !== 0;
  let forwardStart = 0;
  let forwardEnd = 0;
  let reverseStart = 0;
  let reverseEnd = 0;

  for (let distance = 0; distance < maxDistance; distance++) {
    for (let diagonal = -distance + forwardStart; diagonal <= distance - forwardEnd; diagonal += 2) {
      const vectorIndex = vectorOffset + diagonal;
      let x: number;

      if (diagonal === -distance || (diagonal !== distance && forward[vectorIndex - 1] < forward[vectorIndex + 1])) {
        x = forward[vectorIndex + 1];
      } else {
        x = forward[vectorIndex - 1] + 1;
      }

      let y = x - diagonal;
      while (x < length1 && y < length2 && values1[x] === values2[y]) {
        x++;
        y++;
      }
      forward[vectorIndex] = x;

      if (x > length1) {
        forwardEnd += 2;
      } else if (y > length2) {
        forwardStart += 2;
      } else if (front) {
        const reverseIndex = vectorOffset + delta - diagonal;
        if (reverseIndex >= 0 && reverseIndex < vectorLength && reverse[reverseIndex] !== -1) {
          const reverseX = length1 - reverse[reverseIndex];
          if (x >= reverseX) {
            return bisectSplit(values1, values2, x, y);
          }
        }
      }
    }

    for (let diagonal = -distance + reverseStart; diagonal <= distance - reverseEnd; diagonal += 2) {
      const vectorIndex = vectorOffset + diagonal;
      let x: number;

      if (diagonal === -distance || (diagonal !== distance && reverse[vectorIndex - 1] < reverse[vectorIndex + 1])) {
        x = reverse[vectorIndex + 1];
      } else {
        x = reverse[vectorIndex - 1] + 1;
      }

      let y = x - diagonal;
      while (x < length1 && y < length2 && values1[length1 - x - 1] === values2[length2 - y - 1]) {
        x++;
        y++;
      }
      reverse[vectorIndex] = x;

      if (x > length1) {
        reverseEnd += 2;
      } else if (y > length2) {
        reverseStart += 2;
      } else if (!front) {
        const forwardIndex = vectorOffset + delta - diagonal;
        if (forwardIndex >= 0 && forwardIndex < vectorLength && forward[forwardIndex] !== -1) {
          const forwardX = forward[forwardIndex];
          const forwardY = vectorOffset + forwardX - forwardIndex;
          const reverseX = length1 - x;
          if (forwardX >= reverseX) {
            return bisectSplit(values1, values2, forwardX, forwardY);
          }
        }
      }
    }
  }

  return [
    { operation: DELETE, values: values1 },
    { operation: INSERT, values: values2 },
  ];
}

function bisectSplit(values1: number[], values2: number[], x: number, y: number): EncodedDiff[] {
  return diffSequences(values1.slice(0, x), values2.slice(0, y)).concat(
    diffSequences(values1.slice(x), values2.slice(y)),
  );
}

function cleanupMerge(diffs: EncodedDiff[]): void {
  diffs.push({ operation: EQUAL, values: [] });
  let pointer = 0;
  let deleteCount = 0;
  let insertCount = 0;
  let deletedValues: number[] = [];
  let insertedValues: number[] = [];

  while (pointer < diffs.length) {
    const diff = diffs[pointer];
    if (diff.operation === INSERT) {
      insertCount++;
      insertedValues = insertedValues.concat(diff.values);
      pointer++;
      continue;
    }
    if (diff.operation === DELETE) {
      deleteCount++;
      deletedValues = deletedValues.concat(diff.values);
      pointer++;
      continue;
    }

    if (deleteCount + insertCount > 1) {
      if (deleteCount !== 0 && insertCount !== 0) {
        const prefixLength = commonPrefix(insertedValues, deletedValues);
        if (prefixLength !== 0) {
          const editStart = pointer - deleteCount - insertCount;
          const prefix = insertedValues.slice(0, prefixLength);
          if (editStart > 0 && diffs[editStart - 1].operation === EQUAL) {
            diffs[editStart - 1].values = diffs[editStart - 1].values.concat(prefix);
          } else {
            diffs.unshift({ operation: EQUAL, values: prefix });
            pointer++;
          }
          insertedValues = insertedValues.slice(prefixLength);
          deletedValues = deletedValues.slice(prefixLength);
        }

        const suffixLength = commonSuffix(insertedValues, deletedValues);
        if (suffixLength !== 0) {
          const suffix = insertedValues.slice(insertedValues.length - suffixLength);
          diff.values = suffix.concat(diff.values);
          insertedValues = insertedValues.slice(0, insertedValues.length - suffixLength);
          deletedValues = deletedValues.slice(0, deletedValues.length - suffixLength);
        }
      }

      pointer -= deleteCount + insertCount;
      diffs.splice(pointer, deleteCount + insertCount);
      if (deletedValues.length !== 0) {
        diffs.splice(pointer, 0, { operation: DELETE, values: deletedValues });
        pointer++;
      }
      if (insertedValues.length !== 0) {
        diffs.splice(pointer, 0, { operation: INSERT, values: insertedValues });
        pointer++;
      }
      pointer++;
    } else if (pointer !== 0 && diffs[pointer - 1].operation === EQUAL) {
      diffs[pointer - 1].values = diffs[pointer - 1].values.concat(diff.values);
      diffs.splice(pointer, 1);
    } else {
      pointer++;
    }

    insertCount = 0;
    deleteCount = 0;
    deletedValues = [];
    insertedValues = [];
  }

  if (diffs.at(-1)?.values.length === 0) {
    diffs.pop();
  }

  let changed = false;
  pointer = 1;
  while (pointer < diffs.length - 1) {
    const previous = diffs[pointer - 1];
    const edit = diffs[pointer];
    const next = diffs[pointer + 1];

    if (previous.operation === EQUAL && next.operation === EQUAL) {
      if (endsWithSequence(edit.values, previous.values)) {
        edit.values = previous.values.concat(edit.values.slice(0, edit.values.length - previous.values.length));
        next.values = previous.values.concat(next.values);
        diffs.splice(pointer - 1, 1);
        changed = true;
      } else if (startsWithSequence(edit.values, next.values)) {
        previous.values = previous.values.concat(next.values);
        edit.values = edit.values.slice(next.values.length).concat(next.values);
        diffs.splice(pointer + 1, 1);
        changed = true;
      }
    }
    pointer++;
  }

  if (changed) {
    cleanupMerge(diffs);
  }
}

function sequencesEqual(values1: number[], values2: number[]): boolean {
  return values1.length === values2.length && startsWithSequence(values1, values2);
}

function startsWithSequence(values: number[], prefix: number[]): boolean {
  if (prefix.length > values.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index++) {
    if (values[index] !== prefix[index]) {
      return false;
    }
  }
  return true;
}

function endsWithSequence(values: number[], suffix: number[]): boolean {
  if (suffix.length > values.length) {
    return false;
  }

  const offset = values.length - suffix.length;
  for (let index = 0; index < suffix.length; index++) {
    if (values[offset + index] !== suffix[index]) {
      return false;
    }
  }
  return true;
}

function commonPrefix(values1: number[], values2: number[]): number {
  const maxLength = Math.min(values1.length, values2.length);
  let length = 0;
  while (length < maxLength && values1[length] === values2[length]) {
    length++;
  }
  return length;
}

function commonSuffix(values1: number[], values2: number[]): number {
  const maxLength = Math.min(values1.length, values2.length);
  let length = 0;
  while (length < maxLength && values1[values1.length - length - 1] === values2[values2.length - length - 1]) {
    length++;
  }
  return length;
}

function indexOfSequence(values: number[], searchValues: number[]): number {
  if (searchValues.length === 0) {
    return 0;
  }

  const prefixLengths = new Int32Array(searchValues.length);
  for (let index = 1, prefixLength = 0; index < searchValues.length;) {
    if (searchValues[index] === searchValues[prefixLength]) {
      prefixLengths[index++] = ++prefixLength;
    } else if (prefixLength !== 0) {
      prefixLength = prefixLengths[prefixLength - 1];
    } else {
      prefixLengths[index++] = 0;
    }
  }

  for (let valueIndex = 0, searchIndex = 0; valueIndex < values.length;) {
    if (values[valueIndex] === searchValues[searchIndex]) {
      valueIndex++;
      searchIndex++;
      if (searchIndex === searchValues.length) {
        return valueIndex - searchIndex;
      }
    } else if (searchIndex !== 0) {
      searchIndex = prefixLengths[searchIndex - 1];
    } else {
      valueIndex++;
    }
  }

  return -1;
}
