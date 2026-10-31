# LWON — Lightweight Object Notation

LWON is JSON with the keys written once. A header names the fields; the body
holds only the values, by position. Any JSON value converts to LWON and back
without loss, and the result is 18–44% fewer tokens than minified JSON on
typical API and tool data.

```
{[orders[id customer[name city] [items[sku qty price]]]] page}
[[
[A-1 [Ann Istanbul] [[SKU1 2 9.99] [SKU2 1 19.5]]]
[A-2 [Bob Izmir] []]
] 1]
```

```json
{"orders":[{"id":"A-1","customer":{"name":"Ann","city":"Istanbul"},"items":[{"sku":"SKU1","qty":2,"price":9.99},{"sku":"SKU2","qty":1,"price":19.5}]},{"id":"A-2","customer":{"name":"Bob","city":"Izmir"},"items":[]}],"page":1}
```

Created by **Ahmet Zencirli**.

## Why

LLM prompts are full of JSON: tool results, API responses, retrieved records.
Most of those tokens are repeated keys, quotes and punctuation. LWON removes the
repetition while keeping the structure readable, including nested and recursive
data, where table formats fall back to verbose layouts.

| Dataset | JSON (minified) | TOON | LWON |
|---|--:|--:|--:|
| Flat table, 100 rows | 2942 | 1744 | **1649** |
| Nested orders | 5400 | 5753 | **3624** |
| GitHub-style issues | 2971 | 3526 | **2018** |
| Recursive menu | 395 | 530 | **282** |
| Logs with optional fields | 3126 | 3619 | **2513** |
| Search tool result | 1985 | **1608** | 1623 |

Tokens, o200k tokenizer. Full table and method in [bench/RESULTS.md](bench/RESULTS.md).

## Use it

```bash
npm install lwon
```

```ts
import { encode, decode, PRIMER } from 'lwon';

const text = encode(data);   // any JSON value → LWON
const back = decode(text);   // LWON → the same JSON value

// Give a model the data plus the short explanation of the format.
const prompt = `${PRIMER}\n\n${text}`;
```

```bash
npx lwon encode data.json      # JSON → LWON
npx lwon decode data.lwon      # LWON → JSON
npx lwon stats data.json       # size of JSON vs LWON
npx lwon primer                # the prompt explanation
```

## With language models

Models do not know LWON yet, so send the [primer](ai/lwon-primer.md) (about 220
tokens) once alongside the data. It pays off as soon as the data is a few
hundred tokens long. Convert data **before** it reaches the model, in your
tool or API layer; asking the model to convert saves nothing.

## Repository

| Path | Contents |
|---|---|
| [SPEC.md](SPEC.md) | The LWON 1.0 specification |
| [packages/lwon](packages/lwon) | Reference TypeScript library and CLI, no dependencies |
| [conformance](conformance) | Language-neutral test cases for any implementation |
| [ai](ai) | Primer text for language models |
| [bench](bench) | Token benchmark against JSON and TOON |

```bash
npm install
npm test         # conformance cases and 3000 fuzzed round trips
npm run bench    # regenerate bench/RESULTS.md
```

## Status

1.0 beta. The format is stable enough to try; it may still change before 1.0.
Planned: an MCP proxy that converts any MCP server's tool results to LWON,
comprehension benchmarks with real models, Claude token counts, and ports to
Python and Go.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
