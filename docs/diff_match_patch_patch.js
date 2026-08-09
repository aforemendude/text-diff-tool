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
