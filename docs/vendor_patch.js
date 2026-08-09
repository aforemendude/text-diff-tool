/*
 * Compatibility shim for the vendored diff-match-patch line encoder.
 *
 * `diff_linesToChars_` uses a normal object as its line-to-token map. The `__proto__` case is a bug in the library
 * itself: assigning that key invokes the inherited `__proto__` setter instead of creating an own map entry. The other
 * inherited names, such as `constructor`, `toString`, and `hasOwnProperty`, are an integration issue: this app freezes
 * `Object.prototype` in `src/main.tsx`, preventing assignments to the map from shadowing those properties. In either
 * case, the same unchanged line can receive different tokens in the two inputs and be displayed as modified.
 *
 * Prefixing every non-empty line with a NUL makes its map key distinct from `Object.prototype` names. The prefix is
 * removed from `lineArray` so callers get the original text back.
 *
 * The app no longer relies on this workaround for its whole-line diff. `src/utils/lineDiffUtils.ts` now represents
 * lines with numeric array entries and stores them in a `Map`, where inherited property names are safe. The vendored
 * engine is still used to diff the characters within one changed line. It may invoke its private line encoder as an
 * optimization for long input, but a single line long enough to enter that path cannot equal any of the short inherited
 * names that caused this issue. The active regression coverage is in `src/utils/lineDiffUtils.test.ts` and
 * `playwright/text-mode.spec.ts`.
 *
 * Keep this shim as a compatibility safeguard in case multiline input is passed to the vendored engine again. It
 * remains separate from `diff_match_patch_uncompressed.js` because that file is vendored. The `diffRuntimePlugin` in
 * `vite.config.ts` appends this file after the vendored script when constructing the worker's virtual runtime module.
 */
(function () {
  var originalDiffLinesToChars = diff_match_patch.prototype.diff_linesToChars_;

  function prefixLines(text) {
    return text.replace(/(^|\n)(?=.)/g, '$1\x00');
  }

  diff_match_patch.prototype.diff_linesToChars_ = function (text1, text2) {
    var result = originalDiffLinesToChars.call(this, prefixLines(text1), prefixLines(text2));
    result.lineArray = result.lineArray.map(function (line) {
      return line.replace(/(^|\n)\x00/g, '$1');
    });
    return result;
  };
})();
