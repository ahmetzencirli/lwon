// Runs the proxy's CLI in front of test/fake-server.mjs and talks to it with the
// MCP SDK client, comparing every answer with what the server gives directly.
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { decode, PRIMER } from '@lwon/core';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const fake = fileURLToPath(new URL('./fake-server.mjs', import.meta.url));

const open: Client[] = [];
after(() => Promise.all(open.map((c) => c.close())));

/** A client for the fake server, through the proxy with `flags`, or directly when `flags` is null. */
async function connect(flags: string[] | null, mode: 'legacy' | 'auto' = 'legacy'): Promise<Client> {
  const args = flags === null ? [fake] : [cli, ...flags, '--', process.execPath, fake];
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode } });
  await client.connect(new StdioClientTransport({ command: process.execPath, args }));
  open.push(client);
  return client;
}

type Block = { type: string; text?: string };
const call = async (client: Client, name: string) => (await client.callTool({ name, arguments: {} })) as { content: Block[]; isError?: boolean; structuredContent?: unknown };
const text = (result: { content: Block[] }, i = 0) => result.content[i]!.text!;

for (const mode of ['legacy', 'auto'] as const) {
  describe(`${mode} protocol negotiation`, async () => {
    const direct = await connect(null, mode);
    const proxied = await connect([], mode);

    test('the session opens in the same era either way', () => {
      assert.equal(proxied.getProtocolEra(), mode === 'auto' ? 'modern' : 'legacy');
      assert.equal(proxied.getProtocolEra(), direct.getProtocolEra());
      assert.deepEqual(proxied.getServerCapabilities(), direct.getServerCapabilities());
    });

    test('listing tools and reading resources pass through unchanged', async () => {
      assert.deepEqual(await proxied.listTools(), await direct.listTools());
      assert.deepEqual(await proxied.listResources(), await direct.listResources());
      const read = { uri: 'fake://users' };
      assert.deepEqual(await proxied.readResource(read), await direct.readResource(read));
    });

    test("the instructions keep the server's own and add the primer", () => {
      const instructions = proxied.getInstructions() ?? '';
      assert.ok(instructions.startsWith(`${direct.getInstructions()}\n\n`));
      assert.ok(instructions.includes(PRIMER));
    });

    test('large JSON results become LWON holding the same data', async () => {
      for (const tool of ['users', 'users_pretty']) {
        const json = text(await call(direct, tool));
        const lwon = text(await call(proxied, tool));
        assert.ok(lwon.length < json.length * 0.8, `${tool}: ${lwon.length} vs ${json.length}`);
        assert.deepEqual(decode(lwon), JSON.parse(json));
        assert.ok(!lwon.includes(PRIMER));
      }
    });

    test('small JSON, other text, images and errors pass through unchanged', async () => {
      for (const tool of ['small', 'prose', 'image', 'fails']) {
        assert.deepEqual(await call(proxied, tool), await call(direct, tool), tool);
      }
    });

    test('in a mixed result only the JSON block changes; structuredContent stays', async () => {
      const [d, p] = [await call(direct, 'mixed'), await call(proxied, 'mixed')];
      assert.deepEqual(p.content[0], d.content[0]);
      assert.deepEqual(p.content[2], d.content[2]);
      assert.deepEqual(decode(text(p, 1)), JSON.parse(text(d, 1)));

      const [ds, ps] = [await call(direct, 'structured'), await call(proxied, 'structured')];
      assert.deepEqual(ps.structuredContent, ds.structuredContent);
      assert.deepEqual(decode(text(ps)), JSON.parse(text(ds)));
    });
  });
}

describe('options', async () => {
  const direct = await connect(null);

  test('--min-chars raises the threshold', async () => {
    const proxied = await connect(['--min-chars', '1000000']);
    assert.deepEqual(await call(proxied, 'users'), await call(direct, 'users'));
  });

  test('--tools and --skip-tools pick the tools to convert', async () => {
    const only = await connect(['--tools', 'users_pretty']);
    assert.equal(text(await call(only, 'users')), text(await call(direct, 'users')));
    assert.notEqual(text(await call(only, 'users_pretty')), text(await call(direct, 'users_pretty')));

    const skip = await connect(['--skip-tools=users*']);
    assert.equal(text(await call(skip, 'users')), text(await call(direct, 'users')));
    assert.notEqual(text(await call(skip, 'mixed'), 1), text(await call(direct, 'mixed'), 1));
  });

  test('--passthrough changes nothing', async () => {
    const proxied = await connect(['--passthrough']);
    assert.equal(proxied.getInstructions(), direct.getInstructions());
    for (const tool of ['users', 'users_pretty', 'mixed']) {
      assert.deepEqual(await call(proxied, tool), await call(direct, tool), tool);
    }
  });

  test('--primer first-result puts the primer before the first converted result only', async () => {
    const proxied = await connect(['--primer', 'first-result']);
    assert.equal(proxied.getInstructions(), direct.getInstructions());
    assert.deepEqual(await call(proxied, 'small'), await call(direct, 'small'));
    const first = text(await call(proxied, 'users'));
    assert.ok(first.startsWith(`${PRIMER}\n\n`));
    assert.deepEqual(decode(first.slice(PRIMER.length + 2)), JSON.parse(text(await call(direct, 'users'))));
    assert.ok(!text(await call(proxied, 'users')).includes(PRIMER));
  });
});
