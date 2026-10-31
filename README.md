# LWON — Lightweight Object Notation

LWON is JSON with the keys written once. A header names the fields; the body
holds only the values, by position. Any JSON value converts to LWON and back
without loss, and the result is 22–42% fewer Claude tokens than minified JSON
on typical API and tool data, with no loss of accuracy in our tests.

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
| Flat table, 100 rows | 4295 | 2510 | **2503** |
| Nested orders | 8259 | 7435 | **4808** |
| GitHub-style issues | 4378 | 4414 | **2760** |
| Recursive menu | 562 | 578 | **362** |
| Logs with optional fields | 4393 | 4472 | **3222** |
| Search tool result | 2930 | **2200** | 2298 |

Claude tokens (Haiku, Sonnet and Opus 5.5 share a tokenizer), counted with the
`count_tokens` API. o200k counts are in [bench/RESULTS.md](bench/RESULTS.md).

**Accuracy.** Claude Haiku 5.5, Sonnet 5.5 and Opus 5.5 answered 44 questions
about this data (lookups, counts, nested fields, trees, absent versus null) in
each format. At medium effort every model answered every question correctly in
JSON, TOON and LWON ([bench/eval/EVAL.md](bench/eval/EVAL.md)). On a harder,
sparse dataset where most fields are optional, LWON scored like JSON: 94% versus
92–95% for Haiku and 44/44 versus 43/44 for Sonnet; every miss in every format
was a count over 150 rows that was off by one or two
([bench/eval/EVAL-sparse.md](bench/eval/EVAL-sparse.md)).

**The catch: models think longer about LWON.** Mapping values to fields by
position costs output tokens, which are priced higher than input. On regular
data, sent once, a question still costs 18–24% less with LWON than with JSON.
When the same data is cached and reused, the saving disappears. On sparse data,
counting questions take Sonnet twice and Haiku four times the output tokens, so
LWON costs more there. Use LWON for large, regular payloads read once; reducing
this reasoning overhead is the next piece of work.

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

# Comprehension eval against the Claude API (needs ANTHROPIC_API_KEY; about $1.30 for all three models)
npm run eval:tokens
npm run eval -- --budget 2
npm run eval -- --suite sparse --trials 3 --budget 2
npm run eval:report
npm run eval:report -- --suite sparse
```

## Status

1.0 beta. The format is stable enough to try; it may still change before 1.0.
Planned: cutting the reasoning overhead on sparse data (primer and encoder
changes, measured with the eval), an MCP proxy that converts any MCP server's
tool results to LWON, and ports to Python and Go.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
