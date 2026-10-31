import { DEFAULT_MIN_CHARS } from './convert.ts';
import type { ProxyOptions } from './proxy.ts';

export const USAGE = `Usage: lwon-mcp-proxy [options] -- <command> [args...]

Runs the MCP server started by <command> and relays its messages, turning
large JSON tool results into LWON to save the model tokens.

Options:
  --min-chars <n>         Leave text shorter than n characters as JSON (default ${DEFAULT_MIN_CHARS})
  --tools <names>         Convert only these tools (comma-separated, * wildcards)
  --skip-tools <names>    Never convert these tools (comma-separated, * wildcards)
  --primer <where>        instructions (default) or first-result
  --passthrough           Change nothing; with --verbose, log what would be converted
  --verbose               Log each conversion to stderr
  --help                  Show this help`;

export interface Cli {
  options: ProxyOptions;
  verbose: boolean;
  command: string;
  args: string[];
}

/** Parses the proxy's own options; the wrapped command starts after `--` or at the first non-option. */
export function parseArgs(argv: string[]): Cli | { help: true } | { error: string } {
  const options: ProxyOptions = {};
  let verbose = false;
  let i = 0;
  for (; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') {
      i++;
      break;
    }
    if (!arg.startsWith('-')) break;
    const eq = arg.indexOf('=');
    const flag = eq < 0 ? arg : arg.slice(0, eq);
    const value = () => (eq < 0 ? argv[++i] : arg.slice(eq + 1));
    const list = () => (value() ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    switch (flag) {
      case '--help':
      case '-h':
        return { help: true };
      case '--min-chars': {
        const n = Number(value());
        if (!Number.isInteger(n) || n < 0) return { error: '--min-chars needs a whole number' };
        options.minChars = n;
        break;
      }
      case '--tools':
        options.tools = list();
        break;
      case '--skip-tools':
        options.skipTools = list();
        break;
      case '--primer': {
        const where = value();
        if (where !== 'instructions' && where !== 'first-result') return { error: '--primer is instructions or first-result' };
        options.primer = where;
        break;
      }
      case '--passthrough':
        options.passthrough = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      default:
        return { error: `Unknown option ${arg}` };
    }
  }
  const [command, ...args] = argv.slice(i);
  if (!command) return { error: 'No server command given' };
  return { options, verbose, command, args };
}
