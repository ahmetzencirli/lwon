# LWON primer for language models

Put this text in the prompt once, next to any LWON data. It is about 330 Claude
tokens, so it pays off once the data it accompanies is larger than a few hundred tokens.
The same text is exported from the library as `PRIMER` and printed by
`lwon primer`.

```text
Data below is in LWON, a compact form of JSON. Line 1 is a header naming the fields; each following row `[...]` holds one object's values in header order.
- Read a row by position: the 1st value belongs to the 1st header field, the 2nd value to the 2nd field, and so on.
- `~` holds the place of a key the object does not have. A row that ends early does not have the remaining keys. `null` means the key is there with the value null.
- A header ending in `*`: a row's last value may be a JSON object holding more of that object's keys, by name. Those keys exist only in the rows that show them.
- `k[x y]` is an object with fields x, y. `[k]` is an array of values. `[k[x y]]` is an array of objects. `@` and `@k` reuse the fields of the top level or of the enclosing k.
- Header `{a b}` is a single object instead of a list; header `*` means plain JSON follows. Unquoted words are strings, and `{...}` values are JSON.
```

## Example

```text
{[orders[id customer[name city] [items[sku qty price]]]] page}
[[
[A-1 [Ann Istanbul] [[SKU1 2 9.99] [SKU2 1 19.5]]]
[A-2 [Bob Izmir] []]
] 1]
```

reads as

```json
{"orders": [
  {"id": "A-1", "customer": {"name": "Ann", "city": "Istanbul"},
   "items": [{"sku": "SKU1", "qty": 2, "price": 9.99}, {"sku": "SKU2", "qty": 1, "price": 19.5}]},
  {"id": "A-2", "customer": {"name": "Bob", "city": "Izmir"}, "items": []}],
 "page": 1}
```
