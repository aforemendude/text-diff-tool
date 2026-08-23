# Code Review: Diff Engine

## Reviewed scope and basis

- Scope: `src/diff/**` production code (`compute.ts`, `types.ts`, `workerProtocol.ts`, `worker.ts`, and
  `workerClient.ts`) plus directly relevant dependency, settings, application-call-site, display-contract, TypeScript,
  Vite, and test-infrastructure context.
- Excluded: generated output, vendored or third-party source, and individual test-case logic, fixtures, and assertions.
- Review basis: static tracing of diff computation, line-alignment, worker request/response, cancellation/recovery, and
  rendering contracts against the installed dependency declarations and repository configuration. Focused checks are
  recorded below.

## Findings

### 1. Grapheme mode merges away the original-side insertion boundary

- Severity: **Low**
- References: `src/diff/compute.ts:173-181`, `src/diff/compute.ts:381-394`
- Problem: `appendCharacterDiff` merges adjacent entries of the same type unless `separateNextCharDiff` is set. The
  delete branch sets that flag on the modified-side builder, preserving two equal spans around an absent deletion, but
  the insert branch does not set the corresponding flag on the original-side builder. For example, comparing `abcd` with
  `abXcd` in grapheme mode emits one original-side equality (`abcd`) instead of the two equalities (`ab`, `cd`) needed
  to retain the insertion position. This conflicts with the display contract in
  `src/components/CompareDisplay.tsx:373-378` and `src/components/CompareDisplay.css:166-171`, which draws an
  absent-side marker only between adjacent equal spans.
- Impact: Interior insertions have no position marker in the original pane in whole-content grapheme mode. Users can see
  the inserted text on the modified side, but cannot see its precise corresponding boundary on the original side;
  deletion boundaries and line-then-grapheme mode do not have this asymmetry.
- Recommendation: Set `originalBuilder.separateNextCharDiff` when consuming an inserted token so the following equality
  starts a new segment, mirroring the modified-side handling for deletions. Preserve the split through cleanup modes and
  line transitions.

## Reviewed areas without verified findings

- Worker creation, request serialization, single-request enforcement, completion/error handling, cancellation, stale
  event isolation, worker replacement, and retry behavior were reviewed; no verified findings were identified in this
  milestone. This does not imply that those paths are defect-free.
- Worker request/response types, result-model invariants, JSON normalization/error flow, installed dependency contracts,
  and the line-then-grapheme alignment path were reviewed; no additional verified findings were identified. This does
  not imply that those areas are defect-free.

## Unresolved questions

None.

## Checks and areas not covered

- `npx tsc -b --pretty false` completed successfully.
- `npm test -- src/diff/compute.test.ts src/diff/worker.test.ts src/diff/workerClient.test.ts` completed successfully: 3
  files and 60 checks passed.
- `npm ls @aforemendude/diff @aforemendude/json-parse --depth=0` confirmed the manifest-selected direct versions are
  installed without an npm dependency error.
- Focused direct execution confirmed the finding for both selectable algorithms and all three cleanup modes.
- Randomized LF-oriented invariant checks covered both diff modes, both algorithms, and all cleanup modes. They found no
  unaligned result arrays, non-sequential source line numbers, character segments that failed to reconstruct their line,
  or successful differences composed entirely of equal rows and equal trailing-newline metadata.
- Browser integration was not run; the finding was verified at the computation boundary and against the renderer's
  static marker contract.
- Dependency installation or repair was not performed. Generated `docs/` output, third-party implementation source, and
  individual test-case logic, fixtures, and assertions were not reviewed.
