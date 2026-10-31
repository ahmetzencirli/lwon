#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { decode, encode, LwonError, PRIMER } from './index.ts';

const USAGE = `Usage: lwon <command> [file]

Commands:
  encode [file]   JSON to LWON
  decode [file]   LWON to JSON (add --pretty to indent)
  stats [file]    Compare the size of JSON and LWON for a JSON file
  primer          Print the LWON explanation to put in an LLM prompt

Reads standard input when no file is given.`;

function main(argv: string[]): number {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const [command, file] = args;

  if (!command || flags.has('--help')) {
    console.log(USAGE);
    return command ? 0 : 1;
  }
  if (command === 'primer') {
    console.log(PRIMER);
    return 0;
  }

  const input = readFileSync(file ?? 0, 'utf8');
  switch (command) {
    case 'encode':
      process.stdout.write(encode(JSON.parse(input)) + '\n');
      return 0;
    case 'decode':
      process.stdout.write(JSON.stringify(decode(input), null, flags.has('--pretty') ? 2 : undefined) + '\n');
      return 0;
    case 'stats': {
      const value = JSON.parse(input);
      const rows: [string, string][] = [
        ['JSON (indented)', JSON.stringify(value, null, 2)],
        ['JSON (minified)', JSON.stringify(value)],
        ['LWON', encode(value)],
      ];
      const base = Buffer.byteLength(rows[1][1]);
      for (const [label, text] of rows) {
        const bytes = Buffer.byteLength(text);
        const change = ((bytes / base - 1) * 100).toFixed(1);
        console.log(`${label.padEnd(16)} ${String(bytes).padStart(10)} bytes  ${change.padStart(6)}% vs minified JSON`);
      }
      return 0;
    }
    default:
      console.error(`Unknown command '${command}'.\n\n${USAGE}`);
      return 1;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof LwonError || e instanceof SyntaxError ? `lwon: ${e.message}` : e);
  process.exitCode = 1;
}
