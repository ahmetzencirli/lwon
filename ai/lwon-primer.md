# LWON primer for language models

Put this text in the prompt once, next to any LWON data. It is about 220 tokens,
so it pays off once the data it accompanies is larger than a few hundred tokens.
The same text is exported from the library as `PRIMER` and printed by
`lwon primer`.

```text
Data below is in LWON, a compact form of JSON. Line 1 is a header naming the fields; the rest holds only values, matched to fields by position.
- Header `a b`: a list of objects, one row `[...]` per object. `{a b}`: a single object. `*`: plain JSON follows.
- `k[x y]` is an object with fields x, y. `[k]` is an array of values. `[k[x y]]` is an array of objects with fields x, y.
- `@` means "same fields as the top level"; `@k` means "same fields as the enclosing k". `[@k]` means `[k[@k]]`.
- `~` means the key is absent; a row that ends early leaves its remaining keys absent. `null`, `[]`, `{}` mean what they do in JSON.
- Unquoted words are strings. A value written as JSON (`{...}` or, in a plain field, `[...]`) is taken as that JSON.
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
