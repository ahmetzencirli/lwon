import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode, encode } from '../src/index.ts';
import { canonical } from './util.ts';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** mulberry32: small seeded PRNG so failures are reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRINGS = [
  '', ' ', 'a', 'Alice', 'true', 'null', 'false', '42', '-1', '1e5', '~', '@', '*', '[', ']', '{', '}',
  '"', '\\', ',', 'a b', 'a,b', 'line\nbreak', '\t', '\u0000', ' ', 'İstanbul', '東京', '🚀', '👨‍👩‍👧',
  'user@example.com', 'https://x.dev/a?b=1', '_x', 'x~y', 'NaN', 'Infinity', '__proto__', 'constructor',
];
const KEYS = ['id', 'name', 'a', 'b', 'children', 'items', '', 'first name', '@type', '123', 'true', '__proto__', 'şehir', 'a-b', 'x.y'];

function generator(seed: number) {
  const r = rng(seed);
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)];

  const primitive = (): Json => {
    const n = r();
    if (n < 0.1) return null;
    if (n < 0.2) return r() < 0.5;
    if (n < 0.45) return pick([0, 1, -1, 0.5, -0.25, 1e21, 1.5e-7, 123456789, Math.round(r() * 1000)]);
    return r() < 0.6 ? pick(STRINGS) : pick(STRINGS) + pick(STRINGS);
  };

  // Objects use a null prototype so a '__proto__' key is an ordinary key.
  // A template object reused with gaps, so arrays hold "similar" objects as real data does.
  const template = (depth: number): Record<string, () => Json> => {
    const t: Record<string, () => Json> = Object.create(null);
    const n = 1 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const sub = depth > 0 && r() < 0.35 ? template(depth - 1) : null;
      const kind = r();
      t[pick(KEYS)] = sub
        ? kind < 0.5 ? () => instance(sub) : () => Array.from({ length: Math.floor(r() * 3) }, () => instance(sub))
        : kind < 0.15 ? () => value(depth - 1) : primitive;
    }
    return t;
  };
  const instance = (t: Record<string, () => Json>): Json => {
    if (r() < 0.05) return primitive();
    const o: { [k: string]: Json } = Object.create(null);
    for (const [k, f] of Object.entries(t)) if (r() < 0.85) o[k] = f();
    return o;
  };

  const tree = (depth: number): Json => {
    const o: { [k: string]: Json } = Object.create(null);
    o.name = primitive();
    if (depth > 0 && r() < 0.8) o.children = Array.from({ length: Math.floor(r() * 3) }, () => tree(depth - 1));
    return o;
  };

  const value = (depth: number): Json => {
    const n = r();
    if (depth <= 0 || n < 0.3) return primitive();
    if (n < 0.5) return Array.from({ length: Math.floor(r() * 4) }, () => value(depth - 1));
    if (n < 0.65) {
      const o: { [k: string]: Json } = Object.create(null);
      for (let i = Math.floor(r() * 4); i > 0; i--) o[pick(KEYS)] = value(depth - 1);
      return o;
    }
    if (n < 0.75) return Array.from({ length: 1 + Math.floor(r() * 3) }, () => tree(3));
    const t = template(depth);
    return Array.from({ length: Math.floor(r() * 5) }, () => instance(t));
  };

  return () => (r() < 0.7 ? (() => { const t = template(3); return Array.from({ length: 1 + Math.floor(r() * 6) }, () => instance(t)); })() : value(4));
}

test('fuzz: decode(encode(x)) equals x', () => {
  const runs = Number(process.env.LWON_FUZZ_RUNS ?? 3000);
  for (let seed = 1; seed <= runs; seed++) {
    const x = generator(seed)();
    let text = '';
    try {
      text = encode(x);
      assert.deepEqual(canonical(decode(text)), canonical(x));
      text = encode(x, { keyedBelow: 0 });
      assert.deepEqual(canonical(decode(text)), canonical(x));
    } catch (e) {
      assert.fail(`seed ${seed}\ninput: ${JSON.stringify(x)}\nlwon:\n${text}\n${(e as Error).message}`);
    }
  }
});
