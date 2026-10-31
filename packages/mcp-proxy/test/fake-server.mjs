// A small MCP server over stdio for the tests, in plain JavaScript so the
// dist smoke test can run it on Node versions without TypeScript support.
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const USERS = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  active: i % 3 !== 0,
  ...(i % 10 === 0 ? { note: 'admin' } : {}),
}));

const text = (t) => ({ type: 'text', text: t });
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

serveStdio(() => {
  const server = new McpServer(
    { name: 'fake', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} }, instructions: 'Fake server for tests.' },
  );
  const tool = (name, handler) => server.registerTool(name, { description: name }, async () => handler());

  tool('users', () => ({ content: [text(JSON.stringify(USERS))] }));
  tool('users_pretty', () => ({ content: [text(JSON.stringify(USERS, null, 2))] }));
  tool('small', () => ({ content: [text(JSON.stringify(USERS.slice(0, 2)))] }));
  tool('prose', () => ({ content: [text('Not JSON. '.repeat(500))] }));
  tool('image', () => ({ content: [{ type: 'image', data: PIXEL, mimeType: 'image/png' }] }));
  tool('fails', () => ({ content: [text(JSON.stringify(USERS))], isError: true }));
  tool('mixed', () => ({
    content: [text('Users follow.'), text(JSON.stringify(USERS)), { type: 'image', data: PIXEL, mimeType: 'image/png' }],
  }));
  tool('structured', () => ({ content: [text(JSON.stringify({ users: USERS }))], structuredContent: { users: USERS } }));

  server.registerResource('users', 'fake://users', { mimeType: 'application/json' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(USERS) }],
  }));
  return server;
});
