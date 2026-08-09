# Code Review: Diff Engine

## Reviewed scope and basis

- Scope: `src/utils/diffUtils.ts`, `src/utils/jsonUtils.ts`, `src/types/diff.ts`, and `src/diff_match_patch.d.ts`,
  including the production call boundary in `src/App.tsx` and the rendering contract in
  `src/components/CompareDisplay.tsx`.
- Basis: current worktree source, the runtime contract exposed by `public/diff_match_patch_uncompressed.js`, relevant
  project configuration and documentation, and focused existing checks. Vendored/generated diff-match-patch
  implementation files and individual test logic/assertions are out of scope.
- Review segments: JSON parsing/canonicalization; line-level and character-level diff construction; global
  engine/runtime integration; result typing and display handoff.

## Findings

### Distinct JSON numbers can be normalized as identical

- Severity: **Medium**
- References: `src/utils/diffUtils.ts:29-32`; `src/utils/jsonUtils.ts:67-70`
- Problem: JSON mode parses every number into a JavaScript `number` and then serializes that value. This loses
  information from valid JSON numeric tokens. For example, `9007199254740992` and `9007199254740993` both normalize to
  `9007199254740992`, while `1e400` becomes `Infinity` and is serialized as `null`. `computeDiff` therefore reaches its
  normalized-string identity check with equal strings for inputs that contain different values (and, in the latter
  example, different JSON types).
- Impact: The compare action can display “Identical Content” and hide a meaningful identifier, counter, financial value,
  or type change. A user relying on JSON mode can miss data changes silently.
- Recommendation: Canonicalize JSON with a parser that preserves numeric tokens/arbitrary precision, or reject numbers
  that cannot be represented losslessly and surface a source-specific validation error. At minimum, validate parsed
  numeric values recursively with `Number.isFinite` and preserve or reject unsafe integers instead of passing their
  rounded values to `JSON.stringify`.

### Frozen prototype names are tokenized as different lines

- Severity: **Low**
- References: `src/utils/diffUtils.ts:80-82`; `src/diff_match_patch.d.ts:50-52`; `src/main.tsx:6-7`
- Problem: Production freezes `Object.prototype`, while the dependency's private line encoder uses a plain object as a
  line-to-token hash. An unterminated final line whose complete content is an inherited property name such as
  `constructor`, `toString`, `hasOwnProperty`, or `__proto__` cannot be installed as an own hash key, so the identical
  line on the other side receives a different token. With original `old\nconstructor` and modified `new\nconstructor`,
  the current production setup labels both `constructor` rows as modified and produces an entirely equal character diff
  for them.
- Impact: Comparisons of source code or property lists can falsely highlight a legitimate unchanged final line. The
  behavior also depends on a non-obvious initialization side effect outside the diff module.
- Recommendation: Replace the private line encoder with an application-owned implementation backed by `Map` or a
  null-prototype object, or use a supported dependency API/version whose line hashing safely accepts arbitrary strings.
  Retain the desired prototype-pollution defense independently of the diff algorithm.

### Appending lines falsely marks the former final line as modified

- Severity: **Medium**
- References: `src/utils/diffUtils.ts:68-82`; `src/utils/diffUtils.ts:126-151`
- Problem: The line encoder treats a line's terminating newline as part of its token. When text without a trailing
  newline gains another line, the unchanged former last line changes from (for example) `a` to the encoded token `a\n`.
  The code later pairs the resulting delete/insert lines and unconditionally labels both as `modify`, even when the
  character diff contains only an equal `a`. The current implementation returns a modified `a` row plus an inserted `b`
  row for original `a` and modified `a\nb`; the `a` row did not change.
- Impact: Common append/remove-at-EOF comparisons show red/green modification styling for unchanged content. A
  trailing-newline-only change likewise marks the final content line as modified in addition to the dedicated
  trailing-newline indicator, undermining the accuracy of the primary visualization.
- Recommendation: Tokenize logical line content independently from line terminators while retaining the existing
  trailing-newline flags, or normalize terminators before line encoding. As a defensive step, classify a paired
  delete/insert as equal when both reconstructed contents are equal rather than emitting a `modify` row whose character
  diff is entirely equal.

### JSON key sorting scales quadratically across arrays of objects

- Severity: **Medium**
- References: `src/utils/jsonUtils.ts:7-32`; `src/utils/jsonUtils.ts:67-70`
- Problem: `collectSortedKeys` creates one global list containing every distinct key and every array index in the
  complete value, then passes that list as `JSON.stringify`'s replacer array. The serializer tests the full property
  list against every nested object, so even a homogeneous array of objects incurs approximately array-length ×
  object-count irrelevant property lookups; heterogeneous keys add more. A focused run of the current function over 500,
  1,000, 2,000, and 4,000 one-key objects with distinct keys took approximately 12 ms, 45 ms, 177 ms, and 742 ms
  respectively, demonstrating quadratic growth before diffing starts.
- Impact: Moderately large API arrays can freeze the single browser UI thread for seconds in JSON mode, with memory also
  spent on a full deep copy and global key set.
- Recommendation: Sort each object's own entries during a recursive canonicalization pass and serialize the resulting
  structure without a global replacer array, or use a canonical serializer whose work is proportional to each object's
  own keys. Preserve the existing null-prototype handling for untrusted keys.

### Disabling the diff deadline can block the UI indefinitely

- Severity: **Medium**
- References: `src/utils/diffUtils.ts:71-73`; `src/utils/diffUtils.ts:80-82`; `src/utils/diffUtils.ts:127-131`;
  `src/App.tsx:33-35`
- Problem: Every comparison explicitly sets `Diff_Timeout` to `0`, which the shipped engine defines as an infinite
  deadline. The dependency also disables its half-match speedup in this mode to avoid a non-optimal result. Both the
  initial line diff and every paired character diff run synchronously inside the Compare click handler, and neither
  input size nor work is bounded.
- Impact: Large or adversarial lines can monopolize the browser's main thread with no way to cancel. In a focused engine
  run, two unrelated pseudo-random 12,000-character lines already took about 2.5 seconds on the review environment;
  runtime grows rapidly with input size.
- Recommendation: Keep a finite deadline and accept a coarser but valid fallback diff when it expires, or move
  computation to a cancellable Web Worker. Add explicit input/work limits if fully optimal, synchronous diffs are a
  requirement.

### The private line encoder misreports changes after its unique-line ceiling

- Severity: **Medium**
- References: `src/utils/diffUtils.ts:80-82`; `src/utils/diffUtils.ts:117-171`; `src/diff_match_patch.d.ts:50-52`
- Problem: The directly invoked private line encoder has a runtime ceiling of 40,000 unique line tokens for the original
  input, after which it encodes the entire remainder as one token. Unlike the dependency's supported line-mode flow,
  this custom flow does not re-diff that replacement block as a whole; it splits the reconstructed block and
  positionally labels every delete/insert pair as modified. With 40,010 unique lines and one changed line at position
  40,006, the current implementation marked all 11 lines from 40,000 through 40,010 as modified.
- Impact: Large logs, exports, or generated files can display many unchanged lines as changes, hiding the one real edit
  in a block of false positives.
- Recommendation: Do not build application behavior on these private helpers. Use a line-diff implementation without the
  token ceiling, or reproduce the supported algorithm's replacement-block refinement and explicitly handle inputs that
  exceed its unique-line capacity.

### Character highlighting disappears for many emoji substitutions

- Severity: **Medium**
- References: `src/utils/diffUtils.ts:127-147`; `src/components/CompareDisplay.tsx:224-229`
- Problem: Character diffs operate on UTF-16 code units and are forwarded directly into separately styled spans. Many
  emoji share a high surrogate, so comparing `😀` with `😃` yields an equal high-surrogate segment followed by a
  deleted/inserted low-surrogate segment. In Chromium, the complete emoji glyph is shaped with the equal span while the
  changed low-surrogate span has zero rendered width; consequently its delete/insert background is not visible. The
  production UI was exercised directly and showed zero-width changed spans for this comparison.
- Impact: The row-level color says the line changed, but the core character-level visualization does not identify the
  changed emoji. In lines containing several emoji or surrounding text, users cannot reliably locate the actual
  substitution.
- Recommendation: Normalize character-diff boundaries so they never split a Unicode scalar value, and preferably diff
  grapheme clusters via `Intl.Segmenter`. If retaining the current engine, expand any edit that splits a surrogate pair
  so the complete code point is represented by visible delete/insert segments on the respective sides.

### The safe-copy comment contradicts the implementation's array behavior

- Severity: **Low**
- References: `src/utils/jsonUtils.ts:35-41`; `src/utils/jsonUtils.ts:47-53`
- Problem: The comment says all arrays are converted to objects with index keys, but `safeDeepCopy` creates and returns
  an array. The current behavior is appropriate for preserving JSON array semantics; the stated safety mechanism is
  simply not what the code does.
- Impact: A maintainer investigating key ordering or prototype-pollution defenses can form the wrong model of the
  canonicalized structure and make an unnecessary or behavior-breaking change based on the documentation.
- Recommendation: Update the comment to state that objects use null prototypes while arrays remain arrays and their
  elements are copied recursively.

## Unresolved questions

- Should multi-line replacement blocks pair deleted and inserted lines purely by position, or optimize for content
  similarity? The current positional rule aligns original `foo` with inserted `new` for original `foo\nbar` versus
  modified `new\nfoo changed\nbar`, leaving `foo changed` as a separate insertion. Both edit scripts reconstruct the
  inputs, so this was not classified as a defect without a documented pairing contract, but similarity-based pairing
  would provide a more intuitive character diff for this case.

## Checks and areas not covered

- Ran `npm test -- --run src/utils/diffUtils.test.ts src/utils/jsonUtils.test.ts`; both focused files passed (38 tests).
- Ran `npx tsc -p tsconfig.app.json --noEmit --incremental false --pretty false`; the application type-check passed
  without writing build output.
- Directly evaluated the current normalizer under the repository's Node.js runtime and confirmed that the two large
  integer examples produce the same canonical string and that `1e400` and `null` both canonicalize as `null`.
- Exercised `computeDiff` against the complete production initialization and shipped browser engine contract and
  reproduced the frozen-prototype-name false modification, unchanged-EOF-line modification, and 40,000-unique-line
  boundary behavior described above.
- Exhaustively compared more than 1.19 million pairs of short strings over `a`, `b`, and newline characters to verify
  result alignment and source reconstruction; no reconstruction/alignment failure was observed. The run did expose the
  unchanged-EOF-line false modifications reported above.
- Timed focused normalizer and character-diff scaling probes to validate the performance findings; these were diagnostic
  observations rather than exhaustive benchmarks.
- Ran the application in headless Chromium for the emoji substitution and confirmed that the low-surrogate delete/insert
  spans had zero rendered width while the glyph was assigned to the preceding equal span.
- Individual test cases, fixtures, assertions, vendored/generated diff-match-patch source, browser compatibility outside
  the configured toolchain, and exhaustive performance benchmarking are not reviewed.
- The focused Vitest files use an injected engine harness, so their passing result does not exercise defects in the
  shipped private line encoder; no dependency installation or generated-output update was performed.
