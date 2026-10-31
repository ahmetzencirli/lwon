import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decode, encode, LwonError } from '../src/index.ts';
import { canonical } from './util.ts';

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../conformance/${name}`, import.meta.url), 'utf8'));

for (const c of load('roundtrip.json')) {
  test(`roundtrip: ${c.name}`, () => {
    const text = encode(c.json);
    assert.deepEqual(canonical(decode(text)), canonical(c.json), text);
    assert.deepEqual(canonical(decode(encode(c.json, { bareStrings: false }))), canonical(c.json));
    assert.deepEqual(canonical(decode(encode(c.json, { keyedBelow: 0 }))), canonical(c.json));
  });
}

for (const c of load('decode.json')) {
  test(`decode: ${c.name}`, () => {
    assert.deepEqual(canonical(decode(c.lwon)), canonical(c.json));
  });
}

for (const c of load('invalid.json')) {
  test(`invalid: ${c.name}`, () => {
    assert.throws(() => decode(c.lwon), LwonError);
  });
}

for (const c of load('encode.json')) {
  test(`encode: ${c.name}`, () => {
    assert.equal(encode(c.json), c.lwon);
  });
}
