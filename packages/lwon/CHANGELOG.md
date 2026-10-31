# Changelog

## 1.0.0-beta.1

First published release of the LWON 1.0 reference library, as `@lwon/core` on npm.

- `encode` and `decode` for any JSON value, lossless in both directions
  (object key order may change). Tested against the shared conformance suite
  and a fuzzer.
- Headers for a table of objects, a single object (`{fields}`) and any other
  value (`*`); nested objects, lists of objects and recursive types (`@`).
- `null`, `[]`, `{}` and absent keys (`~`) are distinct. Values that do not fit
  the header are written as embedded JSON. Strings without spaces or special
  characters need no quotes.
- Keys present in fewer than half of the objects at a position are written by
  name in a trailing `*` slot (`keyedBelow`, default 0.5). Language models read
  sparse data with far less reasoning this way.
- `PRIMER`: a short explanation of the format to put in an LLM prompt.
- `lwon` CLI: `encode`, `decode`, `stats`, `primer`.

Changes from the 0.x draft are listed in SPEC.md §7.
