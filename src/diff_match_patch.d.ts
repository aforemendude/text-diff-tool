declare class diff_match_patch {
  constructor();

  Diff_Timeout: number;
  Diff_EditCost: number;
  Match_Threshold: number;
  Match_Distance: number;
  Patch_DeleteThreshold: number;
  Patch_Margin: number;
  Match_MaxBits: number;

  diff_main(
    text1: string,
    text2: string,
    opt_checklines?: boolean,
    opt_deadline?: number,
  ): diff_match_patch.Diff[];

  diff_commonPrefix(text1: string, text2: string): number;
  diff_commonSuffix(text1: string, text2: string): number;

  diff_cleanupSemantic(diffs: diff_match_patch.Diff[]): void;
  diff_cleanupSemanticLossless(diffs: diff_match_patch.Diff[]): void;
  diff_cleanupEfficiency(diffs: diff_match_patch.Diff[]): void;
  diff_cleanupMerge(diffs: diff_match_patch.Diff[]): void;

  diff_xIndex(diffs: diff_match_patch.Diff[], loc: number): number;
  diff_prettyHtml(diffs: diff_match_patch.Diff[]): string;

  diff_text1(diffs: diff_match_patch.Diff[]): string;
  diff_text2(diffs: diff_match_patch.Diff[]): string;

  diff_levenshtein(diffs: diff_match_patch.Diff[]): number;

  diff_toDelta(diffs: diff_match_patch.Diff[]): string;
  diff_fromDelta(text1: string, delta: string): diff_match_patch.Diff[];

  match_main(text: string, pattern: string, loc: number): number;

  patch_make(
    a: string | diff_match_patch.Diff[],
    opt_b?: string | diff_match_patch.Diff[],
    opt_c?: diff_match_patch.Diff[],
  ): diff_match_patch.patch_obj[];

  patch_deepCopy(
    patches: diff_match_patch.patch_obj[],
  ): diff_match_patch.patch_obj[];
  patch_apply(
    patches: diff_match_patch.patch_obj[],
    text: string,
  ): [string, boolean[]];

  patch_addPadding(patches: diff_match_patch.patch_obj[]): string;
  patch_splitMax(patches: diff_match_patch.patch_obj[]): void;

  patch_toText(patches: diff_match_patch.patch_obj[]): string;
  patch_fromText(textline: string): diff_match_patch.patch_obj[];
}

declare namespace diff_match_patch {
  class Diff {
    constructor(op: number, text: string);
    0: number; // Operation
    1: string; // Text
    length: number;
    toString(): string;
  }

  class patch_obj {
    constructor();
    diffs: Diff[];
    start1: number | null;
    start2: number | null;
    length1: number;
    length2: number;
    toString(): string;
  }
}

declare var DIFF_DELETE: number;
declare var DIFF_INSERT: number;
declare var DIFF_EQUAL: number;
