import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode } from '@lwon/core';
import { convertText, convertToolResult, toolSelected } from '../src/index.ts';
import { parseArgs } from '../src/args.ts';

const rows = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}`, price: i * 1.5, tags: ['a', 'b'] }));
const big = JSON.stringify(rows);
const text = (t: string) => ({ type: 'text', text: t });

test('JSON text above the threshold becomes LWON that decodes to the same data', () => {
  const lwon = convertText(big);
  assert.ok(lwon);
  assert.ok(lwon.length < big.length);
  assert.deepEqual(decode(lwon), rows);
});

test('text below the threshold stays as it is', () => {
  assert.equal(convertText(JSON.stringify(rows.slice(0, 3))), undefined);
  assert.equal(convertText(big, big.length + 1), undefined);
  assert.ok(convertText(big, big.length));
});

test('non-JSON text stays as it is', () => {
  assert.equal(convertText('x'.repeat(5000)), undefined);
  assert.equal(convertText(`[not json ${'x'.repeat(5000)}`), undefined);
  assert.equal(convertText(JSON.stringify('a long string '.repeat(500))), undefined);
});

test('JSON that LWON does not shorten stays as it is', () => {
  const blob = JSON.stringify({ data: 'x'.repeat(5000) });
  assert.equal(convertText(blob), undefined);
});

test('only JSON text blocks of successful results are converted', () => {
  const image = { type: 'image', data: 'AAAA', mimeType: 'image/png' };
  const result = { content: [text('Here you go.'), text(big), image], structuredContent: { rows } };
  const out = convertToolResult(result);
  assert.equal(out.converted, 1);
  const content = out.result.content as { text?: string }[];
  assert.equal(content[0], result.content[0]);
  assert.equal(content[2], image);
  assert.deepEqual(decode(content[1]!.text!), rows);
  assert.equal(out.result.structuredContent, result.structuredContent);
  assert.equal(out.before, big.length);
  assert.equal(out.after, content[1]!.text!.length);

  for (const skipped of [
    { content: [text(big)], isError: true },
    { content: [text(big)], resultType: 'input_required' },
    { toolResult: rows },
  ]) {
    assert.equal(convertToolResult(skipped).result, skipped);
  }
  assert.equal(convertToolResult({ content: [text(big)], resultType: 'complete' }).converted, 1);
});

test('the allow and deny lists pick tools by name, with wildcards', () => {
  assert.ok(toolSelected('search', {}));
  assert.ok(toolSelected('search', { tools: ['search', 'list'] }));
  assert.ok(!toolSelected('get', { tools: ['search', 'list'] }));
  assert.ok(toolSelected('list_issues', { tools: ['list_*'] }));
  assert.ok(!toolSelected('list_issues', { skipTools: ['*issues'] }));
  assert.ok(!toolSelected('list_issues', { tools: ['list_*'], skipTools: ['list_issues'] }));
  assert.ok(!toolSelected('a.b', { tools: ['a?b'] }));
});

test('command line options come before the server command', () => {
  assert.deepEqual(parseArgs(['--min-chars', '500', '--tools=a,b', '--', 'npx', '-y', 'server', '--flag']), {
    options: { minChars: 500, tools: ['a', 'b'] },
    verbose: false,
    command: 'npx',
    args: ['-y', 'server', '--flag'],
  });
  assert.deepEqual(parseArgs(['--passthrough', '--verbose', '--skip-tools', 'x', 'node', 'server.js']), {
    options: { passthrough: true, skipTools: ['x'] },
    verbose: true,
    command: 'node',
    args: ['server.js'],
  });
  assert.deepEqual(parseArgs(['--primer', 'first-result', '--', 'srv']), {
    options: { primer: 'first-result' },
    verbose: false,
    command: 'srv',
    args: [],
  });
  assert.ok('error' in parseArgs([]));
  assert.ok('error' in parseArgs(['--bogus', '--', 'srv']));
  assert.ok('error' in parseArgs(['--min-chars', 'many', '--', 'srv']));
  assert.ok('error' in parseArgs(['--primer', 'everywhere', '--', 'srv']));
  assert.ok('help' in parseArgs(['--help']));
});
