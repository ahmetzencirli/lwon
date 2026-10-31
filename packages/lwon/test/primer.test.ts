import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIMER } from '../src/index.ts';

test('ai/lwon-primer.md carries the exported PRIMER', () => {
  const md = readFileSync(new URL('../../../ai/lwon-primer.md', import.meta.url), 'utf8');
  assert.ok(md.includes(PRIMER), 'update ai/lwon-primer.md to match src/primer.ts');
});
