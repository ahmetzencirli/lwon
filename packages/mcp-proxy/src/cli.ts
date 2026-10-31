#!/usr/bin/env node
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { parseArgs, USAGE } from './args.ts';
import { connectProxy, type ProxyOptions } from './proxy.ts';

/** Tool results can be large; the SDK's default read limit is 10 MB. */
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;

async function main(argv: string[]): Promise<void> {
  const cli = parseArgs(argv);
  if ('help' in cli) {
    console.error(USAGE);
    return;
  }
  if ('error' in cli) {
    console.error(`lwon-mcp-proxy: ${cli.error}\n\n${USAGE}`);
    process.exitCode = 2;
    return;
  }

  const log = (line: string) => process.stderr.write(`lwon-mcp-proxy: ${line}\n`);
  const server = new StdioClientTransport({
    command: cli.command,
    args: cli.args,
    // The wrapped server gets the environment the proxy was given, API keys included.
    env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)),
    stderr: 'inherit',
    maxBufferSize: MAX_MESSAGE_BYTES,
  });
  const client = new StdioServerTransport(undefined, undefined, { maxBufferSize: MAX_MESSAGE_BYTES });

  const options: ProxyOptions = { ...cli.options, log: cli.verbose ? log : undefined };
  await connectProxy(client, server, options);
  // Set after starting, so a server that fails to start is reported once, by main's catch.
  client.onerror = (error) => log(error.message);
  server.onerror = (error) => log(error.message);

  // connectProxy closes each side when the other one closes; then the proxy is done.
  const done = client.onclose;
  client.onclose = () => {
    done?.();
    setTimeout(() => process.exit(), 100).unref();
  };
  const stop = () => void client.close();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`lwon-mcp-proxy: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
