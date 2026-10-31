# @lwon/mcp-proxy

Put it in front of any stdio [MCP](https://modelcontextprotocol.io) server and
large JSON tool results reach the model as [LWON](https://github.com/ahmetzencirli/lwon),
which takes 21–42% fewer Claude tokens than minified JSON on typical data. The
server needs no changes.

```
MCP client  ⇄  lwon-mcp-proxy  ⇄  your MCP server
                 tools/call results: JSON → LWON
```

The proxy starts the server you name and relays every message unchanged except
two:

- **`tools/call` results.** A text block that is JSON, at least 2000 characters
  long, and at least 10% shorter as LWON is replaced with LWON. Short results,
  plain text, images, audio, resources, errors (`isError`) and
  `structuredContent` pass through as they are.
- **The server's instructions** (in the `initialize` or `server/discover`
  answer) gain a short explanation of LWON, the
  [primer](https://github.com/ahmetzencirli/lwon/blob/main/ai/lwon-primer.md),
  about 330 tokens. The model reads it once per session instead of once per
  result.

It works with both MCP protocol eras: the 2025 `initialize` handshake and the
2026-07-28 revision.

## Setup

Take the command that starts your server and put
`npx -y @lwon/mcp-proxy --` in front of it.

### Claude Code

```bash
claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_... -- npx -y @lwon/mcp-proxy -- npx -y @modelcontextprotocol/server-github
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@lwon/mcp-proxy", "--", "npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
    }
  }
}
```

### Claude Desktop

In `claude_desktop_config.json` (Settings → Developer → Edit Config), wrap the
server's existing `command` and `args` the same way:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@lwon/mcp-proxy", "--", "npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
    }
  }
}
```

Restart Claude Desktop after editing the file.

The wrapped server inherits the proxy's environment, so `env` entries reach it
as before. Its stderr goes to the proxy's stderr, where the client logs it.

## Options

Options go before the `--`.

| Option | Effect |
|---|---|
| `--min-chars <n>` | Leave text shorter than `n` characters as JSON. Default 2000. |
| `--tools <names>` | Convert only these tools. Comma-separated; `*` is a wildcard: `list_*,search`. |
| `--skip-tools <names>` | Never convert these tools. Wins over `--tools`. |
| `--primer first-result` | Put the primer before the first converted result instead of in the server instructions. Use it with clients that do not show server instructions to the model. |
| `--passthrough` | Change nothing. With `--verbose`, still log what would have been converted. Handy for comparing. |
| `--verbose` | Log each conversion to stderr: `list_issues: 48210 -> 27905 chars (-42%)`. |

## When it helps

LWON saves the most on lists of records with the same keys (search results,
issues, rows, logs) and on nested data. It cannot shrink long free text, so a
result that would not get at least 10% shorter is left alone. Results below the
threshold stay JSON because the saving there is small.

LWON is lossless: the text decodes back to the same JSON. A model reading it
answered lookups, counts and nested questions as accurately as with JSON in our
[evals](https://github.com/ahmetzencirli/lwon/blob/main/bench/eval/EVAL.md).

## As a library

```ts
import { connectProxy, convertToolResult } from '@lwon/mcp-proxy';

// Relay between any two MCP SDK transports, e.g. to serve a remote server over stdio.
await connectProxy(transportToClient, transportToServer, { minChars: 1000 });

// Or convert one tools/call result yourself.
const { result, converted } = convertToolResult(callToolResult, { minChars: 1000 });
```

## Limits

- stdio only. The proxy itself speaks stdio to the client and starts the server
  as a child process.
- `structuredContent` stays JSON, since clients read it as data. Clients that
  show it to the model instead of `content` will not see a saving.
- Resource contents (`resources/read`) and embedded resources are not converted.

Created by Ahmet Zencirli. Apache-2.0.
