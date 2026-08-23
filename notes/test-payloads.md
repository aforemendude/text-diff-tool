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
keys, exact unsafe integers, primitive values, and prototype-like property names.

Original:

```text
{"z":null,"large":9007199254740993,"dup":1,"dup":2,"data":[true,{"__proto__":1}],"constructor":{"prototype":2}}
```

Modified:

```text
{ "constructor": { "prototype": 2 }, "data": [true, { "__proto__": 1 }], "dup": 1, "dup": 3, "large": 9007199254740995, "z": null }
```

Expect sorted, consistently formatted output with both `dup` entries and both large integers preserved exactly. Only the
second duplicate value and the large integer should differ; comparison must not error or mutate global prototypes.

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
