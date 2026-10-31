// Counts each dataset in each format with Claude's own tokenizer (count_tokens
// is free). `raw` is the data alone; `prompt` adds the format label or LWON primer
// exactly as the eval sends it. Writes bench/eval/tokens.json.
//
//   node bench/eval/tokens.ts [--models a,b] [--suite sparse] [--dry]   (--dry uses o200k instead)
import { writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { encode as o200k } from 'gpt-tokenizer';
import { encode as toToon } from '@toon-format/toon';
import { encode as toLwon } from '../../packages/lwon/src/index.ts';
import { dataBlock, DEFAULT_MODELS, FORMATS, loadDataset, VARIANTS, type Format } from './eval.ts';

const a = process.argv.slice(2);
const val = (k: string) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
const dry = a.includes('--dry');
const suite = val('--suite') ?? 'basic';
const DATASETS = suite === 'basic' ? ['users', 'orders', 'issues', 'menu', 'logs', 'search'] : [suite];
const models = dry ? ['o200k'] : (val('--models')?.split(',') ?? DEFAULT_MODELS);

const raw = (format: Format, data: unknown) =>
  format === 'json' ? JSON.stringify(data) : format === 'toon' ? toToon(data)
    : toLwon(data, format === 'lwon' ? {} : { keyedBelow: 0 });

const client = dry ? null : new Anthropic({ maxRetries: 6 });
async function count(model: string, text: string): Promise<number> {
  if (!client) return o200k(text).length;
  const r = await client.messages.countTokens({ model, messages: [{ role: 'user', content: text }] });
  return r.input_tokens;
}

const out: Record<string, Record<string, Record<Format, { raw: number; prompt: number }>>> = {};
for (const model of models) {
  out[model] = {};
  // A one-character message measures the fixed per-request overhead, which is subtracted.
  const overhead = client ? await count(model, 'x') - 1 : 0;
  for (const name of DATASETS) {
    const data = loadDataset(name);
    out[model][name] = {} as Record<Format, { raw: number; prompt: number }>;
    for (const f of [...FORMATS, ...VARIANTS]) {
      out[model][name][f] = {
        raw: (await count(model, raw(f, data))) - overhead,
        prompt: (await count(model, dataBlock(f, data))) - overhead,
      };
    }
  }
  console.log(model, JSON.stringify(out[model]));
}
const suffix = `${suite === 'basic' ? '' : `-${suite}`}${dry ? '-dry' : ''}`;
writeFileSync(new URL(`tokens${suffix}.json`, import.meta.url), JSON.stringify(out, null, 2) + '\n');
