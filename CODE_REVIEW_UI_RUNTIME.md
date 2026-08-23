# Code Review: UI Runtime

## Scope and review basis

Reviewed the current production UI/runtime implementation in `src/main.tsx`, `src/App.tsx`, all production files under
`src/components/`, the associated application/component CSS, and `index.html`. I also inspected `src/diff/types.ts`,
`src/diff/compute.ts`, `vite.config.ts`, and the README where needed to validate component contracts, deployment paths,
and user-visible behavior. Tests were consulted only as documentation of intended component contracts; their cases,
fixtures, assertions, and coverage were not reviewed. Generated output, dependency source, and vendored code were
excluded.

Findings were verified against the current source and, where noted, a temporary production build rendered in headless
Chromium.

## Findings

### 1. The modal shell does not implement modal semantics or keyboard focus containment

- **Severity:** Medium
- **Reference:** `src/components/Modal.tsx:29-47`
- **Problem:** The shared modal is rendered as ordinary nested `div` elements. It has no `dialog` role (or native
  `dialog` element), `aria-modal`, association between the dialog and its heading, initial-focus handling, focus trap,
  Escape-key handler, or focus restoration. Chromium verification showed that focus remained on the background About
  button after opening; after tabbing through the modal's three controls, focus moved into both background textareas;
  pressing Escape left the modal open. Because About, Settings, JSON-error, and identical-content dialogs all use this
  shell, the defect affects every modal path.
- **Impact:** Screen-reader users are not informed that a dialog opened or what labels it. Keyboard users can navigate
  and activate obscured application controls while the overlay is present, potentially opening stacked dialogs or
  changing state behind the active dialog, and they lack the conventional Escape dismissal behavior.
- **Recommendation:** Implement the shell with the native `dialog` element and `showModal()` semantics, or add
  `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to a rigorously managed custom dialog. On open, move focus
  to an appropriate dialog control; contain Tab/Shift+Tab within it; support Escape; make the background inert; and
  restore focus to the opener on close.

### 2. Unchanged-section disclosure controls are mouse-only `div` elements

- **Severity:** Medium
- **Reference:** `src/components/CompareDisplay.tsx:117-125`, `src/components/CompareDisplay.tsx:140-151`
- **Problem:** Both the expand and collapse affordances attach `onClick` to a `div` without button semantics,
  `tabIndex`, keyboard activation, or expanded-state metadata. Chromium confirmed that the elements have no role or tab
  stop, cannot receive programmatic focus, and are skipped by keyboard navigation.
- **Impact:** Keyboard and assistive-technology users cannot reveal hidden unchanged lines or collapse an expanded
  section, so part of the comparison's core content is unavailable to them.
- **Recommendation:** Render each disclosure as a real `button` and expose `aria-expanded` plus an `aria-controls`
  relationship to the controlled line block. Preserve the current visual treatment in CSS and ensure the control has a
  visible focus style.

### 3. The header controls overlap one another on narrow viewports

- **Severity:** Medium
- **Reference:** `src/components/Header.css:1-11`, `src/components/Header.css:54-68`
- **Problem:** The header is fixed at 64 pixels high while its 352-pixel-wide control group is absolutely centered; the
  brand and action group remain in the same row, and this stylesheet has no narrow-viewport layout adjustment. In a
  current production build at a 375-by-667 viewport, the brand occupied horizontal coordinates 32-181, the controls
  12-363, and the actions 243-343. The brand overlapped the controls and the controls overlapped the actions.
- **Impact:** On common phone widths, the logo/title, Compare and Settings controls, JSON toggle, and About action draw
  on top of one another. This obscures content and creates overlapping click targets, making the main workflow
  unreliable on mobile even though the editor and comparison styles explicitly contain mobile breakpoints.
- **Recommendation:** Add a responsive header layout that removes absolute centering at narrow widths and either wraps
  controls, stacks them in a second row, or moves secondary actions into a compact menu. Let the header height grow and
  verify non-overlapping hit targets at supported minimum widths.

### 4. Core buttons and custom radio controls have no visible keyboard focus indicator

- **Severity:** Medium
- **Reference:** `src/common.css:49-60`, `src/components/SettingsModal.css:62-68`
- **Problem:** The shared `.btn` rule unconditionally removes the browser outline and supplies no `:focus-visible`
  replacement. Settings radio inputs are also reduced to zero width and height, made transparent, and given no
  focus-driven style on their visible labels. Chromium verification found `outline-style: none` on the focused Compare
  button and a focused Settings radio that was 0-by-0 pixels, fully transparent, and had no rendered outline.
- **Impact:** Keyboard users cannot tell which primary/secondary action or cleanup-mode option will activate. This
  affects Compare/Edit, Settings, modal footer actions, and every Settings cleanup-mode choice.
- **Recommendation:** Retain the native outline or add a high-contrast `:focus-visible` treatment to `.btn`. For each
  visually hidden radio, style the enclosing option via `:has(input:focus-visible)` (or an equivalent adjacent selector)
  with a visible focus ring; hiding the native input off-screen without reducing its focus box to zero is another robust
  option.

### 5. Visible field headings are not programmatically associated with their inputs

- **Severity:** Low
- **Reference:** `src/components/TextAreas.tsx:14-24`, `src/components/TextAreas.tsx:29-39`,
  `src/components/SettingsModal.tsx:107-121`
- **Problem:** The `Original`, `Modified`, and `Edit Cost` text is rendered as headings rather than labels, and none is
  connected with `htmlFor`, `aria-label`, or `aria-labelledby`. Chromium's accessibility tree named the two textareas
  only from their instructional placeholders and exposed the Edit Cost field as an unnamed spinbutton. The latter also
  does not programmatically reference its explanatory paragraph.
- **Impact:** Assistive-technology users do not receive the visible field names consistently; in particular, the enabled
  Edit Cost control lacks any accessible name, and the textareas' announced instructions do not preserve the page's
  visible heading-to-control relationship.
- **Recommendation:** Use `label` elements tied to each input ID, or connect the existing visible headings with
  `aria-labelledby`. Connect the Edit Cost help text with `aria-describedby`; placeholders can remain as supplementary
  entry hints rather than acting as field names.

### 6. The diff's columns and character-level changes are only represented visually

- **Severity:** Medium
- **Reference:** `src/components/CompareDisplay.tsx:103-158`, `src/components/CompareDisplay.tsx:237-242`,
  `src/components/CompareDisplay.tsx:251-269`
- **Problem:** Original/Modified headings, paired rows, line-number gutters, and character changes are built entirely
  from generic `div`/`span` elements and CSS classes. There are no table/column relationships or accessible annotations
  for inserted and deleted character spans. For an `abc` to `axc` comparison, Chromium's accessibility tree flattened
  the complete result to the headings followed by `1 − abc 1 + axc`; the `b` deletion and `x` insertion spans had no
  role or accessible label. A multirow result likewise supplies no programmatic association between each value and its
  Original or Modified column heading.
- **Impact:** Screen-reader users must infer alternating columns from a flat stream and manually compare whole lines;
  they cannot perceive the character-level precision that the UI communicates through background colors. Long or
  multirow comparisons become especially ambiguous.
- **Recommendation:** Represent the paired grid with semantic table headers/rows/cells or equivalent ARIA relationships
  so every line is associated with its side. Add accessible inserted/deleted annotations around changed character runs
  (while avoiding excessively repetitive announcements), and verify the resulting reading order with a screen reader.

## Unresolved questions

- What minimum viewport width is officially supported? The existing editor and compare-view media queries imply that
  phone layouts are intended, but no support boundary is documented.

## Checks and areas not covered

- `npx tsc --noEmit -p tsconfig.app.json` completed successfully.
- `npx vite build --outDir /tmp/text-diff-ui-review.1P2dgH` completed successfully; the temporary output kept generated
  artifacts out of the repository.
- Focused headless-Chromium checks covered the 375-by-667 header layout, modal semantics/focus/Tab/Escape behavior,
  disclosure keyboard reachability, focus styling, field labeling, and the diff result's accessibility-tree structure.
- Firefox, WebKit, touch-only interaction, screen-reader announcements on physical assistive technology, and visual
  contrast were not independently tested.
- Full unit and end-to-end suites were not run for this segment. Individual test cases, fixture data, assertions, and
  coverage were outside the requested review basis.
- Very large-input responsiveness and the diff engine's synchronous runtime were not benchmarked here; that behavior
  crosses into the diff-engine segment.
