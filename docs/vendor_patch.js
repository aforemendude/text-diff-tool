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
 * removed from `lineArray` so callers get the original text back. This stays separate from
 * `diff_match_patch_uncompressed.js` because that file is vendored. It must load after the vendored script and before
 * application code, as arranged in `index.html`. See the inherited-name regression in `playwright/text-mode.spec.ts`.
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
