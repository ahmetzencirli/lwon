// Runs the built CLI in dist/ in front of the fake server, in plain JavaScript,
// so it also works on Node versions that cannot run the .ts tests.
// Usage: npm run build && node test/dist-smoke.mjs
import { fileURLToPath } from 'node:url';
import { decode, PRIMER } from '@lwon/core';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const path = (p) => fileURLToPath(new URL(p, import.meta.url));
const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [path('../dist/cli.js'), '--', process.execPath, path('./fake-server.mjs')],
  }),
);

let failed = 0;
const check = (ok, what) => {
  if (!ok) {
    failed++;
    console.error(`FAIL ${what}`);
  }
};

check(client.getInstructions()?.includes(PRIMER), 'instructions carry the primer');
const users = (await client.callTool({ name: 'users', arguments: {} })).content[0].text;
check(!users.startsWith('[') && decode(users).length === 40, 'large JSON result is LWON');
const small = (await client.callTool({ name: 'small', arguments: {} })).content[0].text;
check(JSON.parse(small).length === 2, 'small result stays JSON');
await client.close();

if (failed) process.exit(1);
console.log(`dist smoke OK on Node ${process.version}`);
