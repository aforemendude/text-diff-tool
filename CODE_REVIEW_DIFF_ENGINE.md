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
