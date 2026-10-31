import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode, PRIMER } from '@lwon/core';
import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { connectProxy, INSTRUCTIONS, type ProxyOptions } from '../src/index.ts';

const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}`, ok: i % 2 === 0 }));
const big = JSON.stringify(rows);

/** A client and a server end with the proxy between them; each end records what it receives. */
async function wire(options: ProxyOptions = {}) {
  const [client, proxyClient] = InMemoryTransport.createLinkedPair();
  const [proxyServer, server] = InMemoryTransport.createLinkedPair();
  const atClient: JSONRPCMessage[] = [];
  const atServer: JSONRPCMessage[] = [];
  client.onmessage = (m) => void atClient.push(m);
  server.onmessage = (m) => void atServer.push(m);
  await connectProxy(proxyClient, proxyServer, options);
  await client.start();
  await server.start();
  const settle = () => new Promise((r) => setTimeout(r, 10));
  return { client, server, atClient, atServer, settle };
}

const toolCall = (id: number, name: string) => ({ jsonrpc: '2.0' as const, id, method: 'tools/call', params: { name } });
const answer = (id: number, result: Record<string, unknown>) => ({ jsonrpc: '2.0' as const, id, result });

test('messages other than tool results pass through unchanged, both ways', async () => {
  const { client, server, atClient, atServer, settle } = await wire();
  const fromClient: JSONRPCMessage[] = [
    { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'x://y' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 'srv-1', result: { role: 'assistant', content: { type: 'text', text: big } } },
  ];
  const fromServer: JSONRPCMessage[] = [
    answer(1, { tools: [{ name: 'a', inputSchema: { type: 'object' } }] }),
    answer(2, { contents: [{ uri: 'x://y', mimeType: 'application/json', text: big }] }),
    { jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', data: big } },
    { jsonrpc: '2.0', id: 'srv-1', method: 'sampling/createMessage', params: { messages: [], maxTokens: 10 } },
    { jsonrpc: '2.0', id: 3, error: { code: -32601, message: 'nope' } },
  ];
  for (const m of fromClient) await client.send(m);
  for (const m of fromServer) await server.send(m);
  await settle();
  assert.deepEqual(atServer, fromClient);
  assert.deepEqual(atClient, fromServer);
});

test('large JSON tool results become LWON', async () => {
  const { client, server, atClient, settle } = await wire();
  await client.send(toolCall(7, 'list'));
  await settle();
  await server.send(answer(7, { content: [{ type: 'text', text: big }] }));
  await settle();
  const result = (atClient[0] as { result: { content: { text: string }[] } }).result;
  assert.notEqual(result.content[0]!.text, big);
  assert.deepEqual(decode(result.content[0]!.text), rows);
});

test('a response is matched to its tools/call by id', async () => {
  const { client, server, atClient, settle } = await wire();
  await client.send({ jsonrpc: '2.0', id: 1, method: 'prompts/get', params: { name: 'p' } });
  await client.send(toolCall(2, 'list'));
  await settle();
  const content = [{ type: 'text', text: big }];
  await server.send(answer(1, { content }));
  await server.send(answer(2, { content }));
  await server.send(answer(2, { content }));
  await settle();
  const texts = atClient.map((m) => (m as { result: { content: { text: string }[] } }).result.content[0]!.text);
  assert.equal(texts[0], big, 'not a tool call');
  assert.notEqual(texts[1], big, 'the tool call');
  assert.equal(texts[2], big, 'a second answer to the same id');
});

test('a cancelled call is forgotten', async () => {
  const { client, server, atClient, settle } = await wire();
  await client.send(toolCall(4, 'list'));
  await client.send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 4 } });
  await settle();
  await server.send(answer(4, { content: [{ type: 'text', text: big }] }));
  await settle();
  assert.equal((atClient[0] as { result: { content: { text: string }[] } }).result.content[0]!.text, big);
});

test('the primer joins the instructions of initialize and server/discover', async () => {
  const { client, server, atClient, settle } = await wire();
  await client.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  await client.send({ jsonrpc: '2.0', id: 2, method: 'server/discover', params: {} });
  await settle();
  await server.send(answer(1, { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 's', version: '1' }, instructions: 'Use search first.' }));
  await server.send(answer(2, { supportedVersions: ['2026-07-28'], capabilities: {} }));
  await settle();
  const [init, discover] = atClient.map((m) => (m as { result: { instructions: string } }).result);
  assert.equal(init!.instructions, `Use search first.\n\n${INSTRUCTIONS}`);
  assert.equal(discover!.instructions, INSTRUCTIONS);
  assert.ok(INSTRUCTIONS.includes(PRIMER));
});

test('with primer first-result, only the first converted result carries the primer', async () => {
  const { client, server, atClient, settle } = await wire({ primer: 'first-result' });
  await client.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  for (const id of [2, 3, 4]) await client.send(toolCall(id, 'list'));
  await settle();
  await server.send(answer(1, { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 's', version: '1' } }));
  await server.send(answer(2, { content: [{ type: 'text', text: 'small' }] }));
  await server.send(answer(3, { content: [{ type: 'text', text: 'intro' }, { type: 'text', text: big }] }));
  await server.send(answer(4, { content: [{ type: 'text', text: big }] }));
  await settle();
  assert.equal((atClient[0] as { result: { instructions?: string } }).result.instructions, undefined);
  const content = atClient.slice(1).map((m) => (m as { result: { content: { text: string }[] } }).result.content);
  assert.equal(content[0]![0]!.text, 'small');
  assert.equal(content[1]![0]!.text, 'intro');
  assert.ok(content[1]![1]!.text.startsWith(`${PRIMER}\n\n`));
  assert.deepEqual(decode(content[1]![1]!.text.slice(PRIMER.length + 2)), rows);
  assert.ok(!content[2]![0]!.text.includes(PRIMER));
});

test('passthrough changes nothing but still reports', async () => {
  const lines: string[] = [];
  const { client, server, atClient, settle } = await wire({ passthrough: true, log: (l) => lines.push(l) });
  await client.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  await client.send(toolCall(2, 'list'));
  await settle();
  const sent = [
    answer(1, { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 's', version: '1' }, instructions: 'own' }),
    answer(2, { content: [{ type: 'text', text: big }] }),
  ];
  for (const m of sent) await server.send(m);
  await settle();
  assert.deepEqual(atClient, sent);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /^list: \d+ -> \d+ chars \(-\d+%\), not sent \(passthrough\)$/);
});

test('tool calls run as tasks are converted when their result is fetched', async () => {
  const { client, server, atClient, settle } = await wire();
  await client.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list', task: { ttl: 1000 } } });
  await settle();
  await server.send(answer(1, { task: { taskId: 't1', status: 'working' } }));
  await settle();
  await client.send({ jsonrpc: '2.0', id: 2, method: 'tasks/result', params: { taskId: 't1' } });
  await settle();
  await server.send(answer(2, { content: [{ type: 'text', text: big }] }));
  await settle();
  const fetched = (atClient[1] as { result: { content: { text: string }[] } }).result;
  assert.deepEqual(decode(fetched.content[0]!.text), rows);
});

test('closing one side closes the other', async () => {
  const { client, server } = await wire();
  let closed = false;
  server.onclose = () => (closed = true);
  await client.close();
  assert.ok(closed);
});
