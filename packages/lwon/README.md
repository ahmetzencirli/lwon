# lwon

Reference implementation of [LWON](https://github.com/ahmetzencirli/lwon), Lightweight Object Notation: JSON with the keys written once. Lossless in both directions, no dependencies, and 21–42% fewer Claude tokens than minified JSON on typical data.

```ts
import { encode, decode, PRIMER } from 'lwon';

encode([{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]);
// id name
// [
// [1 Ann]
// [2 Bob]
// ]

decode('id name\n[[1 Ann] [2 Bob]]');
// [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]
```

- `encode(value, { bareStrings?, keyedBelow? })`: any JSON-serializable value to LWON. Keys in fewer than `keyedBelow` (default 0.5) of the rows are written by name in a `*` slot.
- `decode(text)`: LWON to JSON. Throws `LwonError` with line and column.
- `PRIMER`: a short explanation of the format to put in an LLM prompt.

CLI: `npx lwon encode|decode|stats|primer [file]`.

See the [specification](https://github.com/ahmetzencirli/lwon/blob/main/SPEC.md). Created by Ahmet Zencirli. Apache-2.0.
