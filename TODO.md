# TODO

## Virtualize comparison results

- Render only visible comparison rows while preserving side-by-side alignment and collapsed unchanged sections.
- Incrementally commit large results so progress and cancellation controls remain responsive.
- Add a bounded fallback for results that would create an excessive number of rows or character spans.
- Reuse shared accessible descriptions for inserted and deleted text instead of duplicating hidden nodes per change.
- Cover large, heavily changed inputs, scrolling, keyboard access, and screen-reader output in tests.
