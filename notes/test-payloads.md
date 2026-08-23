# Manual test payloads

Paste each **Original** and **Modified** payload into the matching pane, then select **Compare**. Keep JSON mode off
unless a case says otherwise. The fenced blocks use `text` intentionally so formatters leave the payloads alone.

## Delayed comparison

Leave JSON mode off and keep the default **Line then grapheme**, **Myers**, and **No cleanup** settings. Paste the
complete contents of [slow-diff-original.txt](./slow-diff-original.txt) into **Original** and
[slow-diff-modified.txt](./slow-diff-modified.txt) into **Modified**, then select **Compare**.

The files are intentionally adversarial single-line payloads: each contains 12,500 graphemes and the pair has no
graphemes in common. The default diff took about 2.3 seconds on the reference development machine; timing will vary with
the browser and hardware. Expect the processing dialog to remain visible during the comparison and the final result to
show one fully modified line.

## JSON normalization and safety

Turn on **JSON Mode**. This pair covers formatting and key-order normalization, nested arrays and objects, duplicate
keys, exact unsafe integers, primitive values, prototype-like property names, and the boundary markers for text that
exists on only one side.

Original:

```text
{"z":null,"large":9007199254740993,"dup":1,"dup":2,"data":[true,{"__proto__":1}],"constructor":{"prototype":2},"deleteMarker":"beforeDELETEafter","insertMarker":"beforeafter"}
```

Modified:

```text
{ "constructor": { "prototype": 2 }, "data": [true, { "__proto__": 1 }], "deleteMarker": "beforeafter", "dup": 1, "dup": 3, "insertMarker": "beforeINSERTafter", "large": 9007199254740995, "z": null }
```

Expect sorted, consistently formatted output with both `dup` entries and both large integers preserved exactly. Along
with the changed second duplicate value and large integer, `DELETE` should appear as deleted text with a deletion marker
on the Modified side, while `INSERT` should appear as inserted text with an insertion marker on the Original side.
Comparison must not error or mutate global prototypes.

## Reflowed text

Compare this pair first with the default **Line then grapheme** mode. Then select **Edit**, change the setting to **Just
grapheme**, and compare again.

Original:

```text
The migration guide keeps every shared word visible, even when this deliberately long sentence wraps across the narrow comparison pane.
Only the line break moves; the wording stays exactly the same.
```

Modified:

```text
The migration guide keeps every shared word visible, even when this deliberately long sentence wraps
across the narrow comparison pane. Only the line break moves; the wording stays exactly the same.
```

**Just grapheme** should retain almost all text as equal and show only the moved line break/space. The default mode
produces much broader line-level changes. The first Original line is also long enough to exercise visual wrapping in a
narrow pane.

## Collapsed ranges

Leave the default settings selected and compare this pair. The only change is on line 11, leaving enough unchanged lines
on both sides to create two collapsed ranges.

Original:

```text
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10
Original line 11
Line 12
Line 13
Line 14
Line 15
Line 16
Line 17
Line 18
Line 19
Line 20
Line 21
```

Modified:

```text
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10
Modified line 11
Line 12
Line 13
Line 14
Line 15
Line 16
Line 17
Line 18
Line 19
Line 20
Line 21
```

Expect lines 8 through 14 to remain visible around the change, with a **7 unchanged lines hidden** control both before
and after them. Expand each range independently and confirm that its seven lines appear with matching line numbers, the
control changes to **Collapse 7 unchanged lines**, and collapsing it hides those lines again.

## Final newline states

Paste these one-line payloads, then remove any trailing line break introduced by copy and paste.

Original:

```text
final line A
```

Modified:

```text
final line B
```

Compare in these states:

1. Neither side ends with a newline: no final-newline row.
2. Select **Edit**, press Enter once at the end of Modified, and compare: the row should say Original has no final
   newline and Modified does.
3. Select **Edit**, press Enter once at the end of Original, and compare: both now end with a newline, so the row should
   disappear.
