// Regenerates encode.json: the reference encoder's exact output for every roundtrip case.
// Other encoders may produce different (equally valid) text; they should pass roundtrip.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { encode } from '../packages/lwon/src/index.ts';

const dir = new URL('.', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('roundtrip.json', dir), 'utf8'));
const out = cases.map((c: { name: string; json: unknown }) => ({ name: c.name, json: c.json, lwon: encode(c.json) }));
writeFileSync(new URL('encode.json', dir), '[\n' + out.map((c: object) => '  ' + JSON.stringify(c)).join(',\n') + '\n]\n');
