# LWON — Lightweight Object Notation

LWON is JSON with the keys written once. A header names the fields; the body
holds only the values, by position. Any JSON value converts to LWON and back
without loss, and the result is 21–42% fewer Claude tokens than minified JSON
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
| Logs with optional fields | 4393 | 4472 | **3452** |
| Search tool result | 2930 | **2200** | 2298 |

Claude tokens (Haiku, Sonnet and Opus 5.5 share a tokenizer), counted with the
`count_tokens` API. o200k counts are in [bench/RESULTS.md](bench/RESULTS.md).

**Accuracy.** Claude Haiku 5.5, Sonnet 5.5 and Opus 5.5 answered 44 questions
about this data (lookups, counts, nested fields, trees, absent versus null) in
each format, and every model got every question right in JSON, TOON and LWON
([bench/eval/EVAL.md](bench/eval/EVAL.md)). On a harder set of 150 sparse log
events, LWON missed 11 of 176 answers and JSON 9, all counts over many rows off
by one to three, or a sum ([bench/eval/EVAL-sparse.md](bench/eval/EVAL-sparse.md)).

**Cost per question.** Models also think about the data, and output tokens cost
more than input. Counting everything, a question on the regular data cost 21–25%
less with LWON than with JSON when the data is sent once, and 2–15% less when it
is cached. On the sparse data it cost 9–11% less sent once and 6–9% more cached.
LWON 0.x, which wrote every key by position, made models count positions through
rows full of `~` and cost up to three times as much there; writing rare keys by
name in a `*` slot fixed that.

## Use it

```bash
npm install @lwon/core
```

```ts
import { encode, decode, PRIMER } from '@lwon/core';

const text = encode(data);   // any JSON value → LWON
const back = decode(text);   // LWON → the same JSON value

// Give a model the data plus the short explanation of the format.
const prompt = `${PRIMER}\n\n${text}`;
```

```bash
npx @lwon/core encode data.json   # JSON → LWON
npx @lwon/core decode data.lwon   # LWON → JSON
npx @lwon/core stats data.json    # size of JSON vs LWON
npx @lwon/core primer             # the prompt explanation
```

## With language models

Models do not know LWON yet, so send the [primer](ai/lwon-primer.md) (about 220
tokens) once alongside the data. It pays off as soon as the data is a few
hundred tokens long. Convert data **before** it reaches the model, in your
tool or API layer; asking the model to convert saves nothing.

### MCP servers

[`@lwon/mcp-proxy`](packages/mcp-proxy) does this for any stdio MCP server
without changing it: put `npx -y @lwon/mcp-proxy --` in front of the server's
command, and large JSON tool results reach the model as LWON, with the primer
sent once in the server's instructions.

```bash
claude mcp add github -- npx -y @lwon/mcp-proxy -- npx -y @modelcontextprotocol/server-github
```

## Repository

| Path | Contents |
|---|---|
| [SPEC.md](SPEC.md) | The LWON 1.0 specification |
| [packages/lwon](packages/lwon) | Reference TypeScript library and CLI, no dependencies |
| [packages/mcp-proxy](packages/mcp-proxy) | MCP proxy that converts any server's JSON tool results to LWON |
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
Planned: ports to Python and Go.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
