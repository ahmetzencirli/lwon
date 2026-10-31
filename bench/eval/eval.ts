// Comprehension eval: ask Claude the same questions about the same data given
// as JSON, TOON and LWON, and record accuracy and Claude's own token counts.
//
//   node bench/eval/eval.ts --dry                      # no API calls; checks the pipeline
//   node bench/eval/eval.ts --models claude-haiku-5-5  # real run (needs ANTHROPIC_API_KEY)
//   node bench/eval/eval.ts --limit 5                  # first 5 questions only
//   node bench/eval/eval.ts --budget 4                 # stop once this run has spent $4
//   node bench/eval/eval.ts --suite sparse --trials 3  # the sparse suite, each question 3 times
//
// Results append to bench/eval/runs/<model>.jsonl; finished calls are skipped
// on the next run, so an interrupted run can resume. `node bench/eval/report.ts`
// summarises them.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { encode as toToon } from '@toon-format/toon';
import { encode as toLwon, PRIMER } from '../../packages/lwon/src/index.ts';
import { buildQuestions, extractAnswer, isCorrect, type Question } from './questions.ts';
import { buildSparseQuestions, sparseData } from './sparse.ts';

export const FORMATS = ['json', 'toon', 'lwon'] as const;
/**
 * Earlier LWON settings, kept to compare against: `lwon-positional` is the 0.x default
 * (every key positional, first primer); `lwon-p2` is positional with the current primer.
 * `lwon` itself is the library default: sparse keys in the `*` slot, current primer.
 */
export const VARIANTS = ['lwon-positional', 'lwon-p2'] as const;

/** The first primer, used for `lwon-positional`. */
export const PRIMER_V1 = `Data below is in LWON, a compact form of JSON. Line 1 is a header naming the fields; the rest holds only values, matched to fields by position.
- Header \`a b\`: a list of objects, one row \`[...]\` per object. \`{a b}\`: a single object. \`*\`: plain JSON follows.
- \`k[x y]\` is an object with fields x, y. \`[k]\` is an array of values. \`[k[x y]]\` is an array of objects with fields x, y.
- \`@\` means "same fields as the top level"; \`@k\` means "same fields as the enclosing k". \`[@k]\` means \`[k[@k]]\`.
- \`~\` means the key is absent; a row that ends early leaves its remaining keys absent. \`null\`, \`[]\`, \`{}\` mean what they do in JSON.
- Unquoted words are strings. A value written as JSON (\`{...}\` or, in a plain field, \`[...]\`) is taken as that JSON.`;
export type Format = (typeof FORMATS)[number] | (typeof VARIANTS)[number];

/** Primer v2: spells out reading by position, and covers the experimental `*` slot. */

export const DEFAULT_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];

/** USD per million tokens: input, output, cache read, cache write (5 min). */
export const PRICE: Record<string, [number, number, number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-opus-5-5': [4, 20, 0.2, 5],
};
export const costOf = (r: { model: string; usage: Record_['usage'] }) => {
  const p = PRICE[r.model] ?? [0, 0, 0, 0];
  return (r.usage.input * p[0] + r.usage.output * p[1] + r.usage.cacheRead * p[2] + r.usage.cacheWrite * p[3]) / 1e6;
};

const SYSTEM =
  'You answer questions about the data in the user message. Read the data carefully. ' +
  'Give only the final answer inside <answer></answer> tags, with no other text inside the tags.';

/** How each format is introduced. LWON needs its primer; JSON and TOON get a one-line label. */
export function dataBlock(format: Format, data: unknown): string {
  if (format === 'json') return `The data below is JSON.\n\n<data>\n${JSON.stringify(data)}\n</data>`;
  if (format === 'toon') return `The data below is in TOON (Token-Oriented Object Notation).\n\n<data>\n${toToon(data)}\n</data>`;
  if (format === 'lwon-positional') return `${PRIMER_V1}\n\n<data>\n${toLwon(data, { keyedBelow: 0 })}\n</data>`;
  if (format === 'lwon-p2') return `${PRIMER}\n\n<data>\n${toLwon(data, { keyedBelow: 0 })}\n</data>`;
  return `${PRIMER}\n\n<data>\n${toLwon(data)}\n</data>`;
}

export type Suite = 'basic' | 'sparse';
export const SUITES: Record<Suite, () => Question[]> = { basic: buildQuestions, sparse: buildSparseQuestions };

export function loadDataset(name: string): unknown {
  if (name === 'sparse') return sparseData();
  return JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
}

export interface Record_ {
  model: string;
  effort?: string;
  suite?: Suite;
  trial?: number;
  format: Format;
  id: string;
  dataset: string;
  kind: string;
  answer: string | null;
  correct: boolean;
  stop: string | null;
  usage: { input: number; cacheRead: number; cacheWrite: number; output: number };
  ms: number;
  error?: string;
}

const dir = new URL('runs/', import.meta.url);
/** Basic-suite runs at the default effort keep the plain model name; others get a prefix or suffix. */
const runName = (model: string, effort: string, suite: Suite) =>
  `${suite === 'basic' ? '' : `${suite}-`}${model}${effort === 'medium' ? '' : `@${effort}`}`;
const runFile = (model: string, effort: string, suite: Suite) => new URL(`${runName(model, effort, suite)}.jsonl`, dir);

export function readRuns(model: string, effort = 'medium', suite: Suite = 'basic'): Record_[] {
  const f = runFile(model, effort, suite);
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function args() {
  const a = process.argv.slice(2);
  const val = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  return {
    dry: a.includes('--dry'),
    models: val('--models')?.split(',') ?? DEFAULT_MODELS,
    formats: (val('--formats')?.split(',') ?? [...FORMATS]) as Format[],
    limit: Number(val('--limit') ?? Infinity),
    concurrency: Number(val('--concurrency') ?? 4),
    effort: (val('--effort') ?? 'medium') as 'low' | 'medium' | 'high',
    budget: Number(val('--budget') ?? Infinity),
    suite: (val('--suite') ?? 'basic') as Suite,
    trials: Number(val('--trials') ?? 1),
  };
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

async function main() {
  const opt = args();
  const questions = SUITES[opt.suite]().slice(0, opt.limit);
  const datasets = Object.fromEntries([...new Set(questions.map((q) => q.dataset))].map((d) => [d, loadDataset(d)]));
  mkdirSync(dir, { recursive: true });
  const client = opt.dry ? null : new Anthropic({ maxRetries: 6 });
  if (opt.dry) console.log('Dry run: answering from the ground truth, no API calls.');
  let spent = 0;

  for (const model of opt.models) {
    const out = opt.dry ? new URL(`dry-${runName(model, opt.effort, opt.suite)}.jsonl`, dir) : runFile(model, opt.effort, opt.suite);
    const done = new Set(
      (opt.dry ? [] : readRuns(model, opt.effort, opt.suite)).filter((r) => !r.error).map((r) => `${r.format}/${r.id}/${r.trial ?? 0}`),
    );
    // Trials interleave formats so a rate limit or budget stop leaves the formats balanced.
    const jobs = Array.from({ length: opt.trials }, (_, trial) =>
      questions.flatMap((q) => opt.formats.map((format) => ({ format, q, trial }))))
      .flat()
      .filter(({ format, q, trial }) => !done.has(`${format}/${q.id}/${trial}`));
    console.log(`${runName(model, opt.effort, opt.suite)}: ${jobs.length} calls to make, ${done.size} already done.`);

    let n = 0;
    await pool(jobs, opt.concurrency, async ({ format, q, trial }) => {
      if (spent >= opt.budget) return;
      const rec = { ...(await ask(client, model, format, q, datasets[q.dataset], opt.effort)), suite: opt.suite, trial };
      appendFileSync(out, JSON.stringify(rec) + '\n');
      spent += costOf(rec);
      n++;
      if (n % 10 === 0 || n === jobs.length) {
        console.log(`  ${n}/${jobs.length}  $${spent.toFixed(3)} spent  last: ${format} ${q.id} ${rec.error ? 'ERROR ' + rec.error : rec.correct ? 'ok' : 'wrong'}`);
      }
    });
    if (spent >= opt.budget) {
      console.log(`Stopped: this run has spent $${spent.toFixed(2)}, the --budget limit. Run again to resume.`);
      return;
    }
  }
  console.log(`Done. This run spent $${spent.toFixed(2)}.`);
}

async function ask(
  client: Anthropic | null, model: string, format: Format, q: Question, data: unknown, effort: 'low' | 'medium' | 'high',
): Promise<Record_> {
  const base = { model, effort, format, id: q.id, dataset: q.dataset, kind: q.kind };
  const t0 = Date.now();
  if (!client) {
    const answer = q.answer;
    return { ...base, answer, correct: isCorrect(q, answer), stop: 'dry', usage: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, ms: 0 };
  }
  try {
    const res = await client.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          // The data block is identical for every question on a dataset, so it is cached.
          { type: 'text', text: dataBlock(format, data), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: q.question },
        ],
      }],
    });
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const answer = res.stop_reason === 'refusal' ? null : extractAnswer(text);
    return {
      ...base,
      answer,
      correct: isCorrect(q, answer),
      stop: res.stop_reason,
      usage: {
        input: res.usage.input_tokens,
        cacheRead: res.usage.cache_read_input_tokens ?? 0,
        cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
        output: res.usage.output_tokens,
      },
      ms: Date.now() - t0,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw e; // no point continuing
    const msg = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e);
    return { ...base, answer: null, correct: false, stop: null, usage: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, ms: Date.now() - t0, error: msg };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e instanceof Anthropic.AuthenticationError ? 'Authentication failed: set ANTHROPIC_API_KEY.' : e);
    process.exitCode = 1;
  });
}
