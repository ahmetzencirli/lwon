// Runs the conformance suite against the built package in dist/, in plain
// JavaScript, so it also works on Node versions that cannot run the .ts tests.
// Usage: npm run build && node test/dist-smoke.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { decode, encode, LwonError, PRIMER } from '../dist/index.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../../../conformance/${name}`, import.meta.url), 'utf8'));
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v === null || typeof v !== 'object') return v;
  const out = {};
  for (const k of Object.keys(v).sort()) Object.defineProperty(out, k, { value: canonical(v[k]), enumerable: true });
  return out;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

let failed = 0;
const check = (ok, what) => {
  if (!ok) {
    failed++;
    console.error(`FAIL ${what}`);
  }
};

for (const c of load('roundtrip.json')) {
  check(same(decode(encode(c.json)), c.json), `roundtrip: ${c.name}`);
  check(same(decode(encode(c.json, { keyedBelow: 0 })), c.json), `roundtrip positional: ${c.name}`);
}
for (const c of load('decode.json')) check(same(decode(c.lwon), c.json), `decode: ${c.name}`);
for (const c of load('invalid.json')) {
  let threw = false;
  try { decode(c.lwon); } catch (e) { threw = e instanceof LwonError; }
  check(threw, `invalid: ${c.name}`);
}
for (const c of load('encode.json')) check(encode(c.json) === c.lwon, `encode: ${c.name}`);
check(typeof PRIMER === 'string' && PRIMER.length > 100, 'PRIMER export');

// The CLI as installed: encode then decode through the bin script.
const cli = new URL('../dist/cli.js', import.meta.url).pathname;
const lwon = execFileSync(process.execPath, [cli, 'encode'], { input: '[{"a":1,"b":"x y"}]' }).toString();
const back = execFileSync(process.execPath, [cli, 'decode'], { input: lwon }).toString();
check(back.trim() === '[{"a":1,"b":"x y"}]', 'cli encode/decode');

if (failed) {
  console.error(`${failed} check(s) failed on Node ${process.versions.node}`);
  process.exit(1);
}
console.log(`dist smoke test passed on Node ${process.versions.node}`);
