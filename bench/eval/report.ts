// Summarises bench/eval/runs/*.jsonl and the token counts into EVAL.md and results.json
// (EVAL-sparse.md and results-sparse.json for the sparse suite).
//   node bench/eval/report.ts [--suite sparse] [--dry]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { costOf, FORMATS, PRICE, SUITES, type Format, type Record_, type Suite } from './eval.ts';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const suite = (argv.includes('--suite') ? argv[argv.indexOf('--suite') + 1] : 'basic') as Suite;
const suffix = `${suite === 'basic' ? '' : `-${suite}`}${dry ? '-dry' : ''}`;
const questions = SUITES[suite]();
const runsDir = new URL('runs/', import.meta.url);
const prefix = `${dry ? 'dry-' : ''}${suite === 'basic' ? '' : `${suite}-`}`;
const files = existsSync(runsDir)
  ? readdirSync(runsDir).filter((f) => {
      if (!f.endsWith('.jsonl') || !f.startsWith(prefix)) return false;
      const rest = f.slice(prefix.length);
      // The basic suite has no prefix, so exclude the other suites' and dry runs' files.
      return !Object.keys(SUITES).some((s) => s !== 'basic' && rest.startsWith(`${s}-`)) && !rest.startsWith('dry-');
    })
  : [];

// Latest record per model/format/question/trial wins, so re-runs replace errors.
const latest = new Map<string, Record_>();
for (const f of files) {
  for (const line of readFileSync(new URL(f, runsDir), 'utf8').split('\n').filter(Boolean)) {
    const r: Record_ = JSON.parse(line);
    // Label runs by model and, when not the default, by effort.
    const label = r.effort && r.effort !== 'medium' ? `${r.model} (effort ${r.effort})` : r.model;
    latest.set(`${label}/${r.format}/${r.id}/${r.trial ?? 0}`, { ...r, label } as Record_ & { label: string });
  }
}
const records = [...latest.values()];
const records_ = records as (Record_ & { label: string })[];
const models = [...new Set(records_.map((r) => r.label))].sort();
const kinds = [...new Set(questions.map((q) => q.kind))];
const trials = Math.max(1, ...records.map((r) => (r.trial ?? 0) + 1));
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

const cost = (rs: Record_[]) => rs.reduce((s, r) => s + costOf(r), 0);

const intro: Record<Suite, string> = {
  basic: `${questions.length} questions about six datasets`,
  sparse: `${questions.length} questions about 150 log events where most fields are optional and some are null`,
};
const lines: string[] = [suite === 'basic' ? '# Comprehension eval' : `# Comprehension eval: ${suite} suite`, ''];
lines.push(
  `${intro[suite]}, asked ${trials === 1 ? 'once' : `${trials} times`} per format. Each answer is compared with`,
  'a value computed from the data. JSON is minified; LWON is sent with its primer; TOON gets a one-line label.',
  '',
  '## Accuracy',
  '',
  ...(trials > 1 ? ['Correct answers over all trials; in brackets, the questions answered wrong at least once.', ''] : []),
  `| Model | ${FORMATS.map((f) => f.toUpperCase()).join(' | ')} |`,
  `|---|${FORMATS.map(() => '--:').join('|')}|`,
);
const summary: Record<string, Record<Format, { correct: number; total: number; errors: number; cost: number; missed: string[]; byKind: Record<string, [number, number]> }>> = {};
for (const m of models) {
  summary[m] = {} as (typeof summary)[string];
  const cells = FORMATS.map((f) => {
    const rs = records_.filter((r) => r.label === m && r.format === f);
    const ok = rs.filter((r) => r.correct).length;
    const byKind = Object.fromEntries(kinds.map((k) => {
      const kr = rs.filter((r) => r.kind === k);
      return [k, [kr.filter((r) => r.correct).length, kr.length] as [number, number]];
    }));
    const missed = [...new Set(rs.filter((r) => !r.correct).map((r) => r.id))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    summary[m][f] = { correct: ok, total: rs.length, errors: rs.filter((r) => r.error).length, cost: cost(rs), missed, byKind };
    return `${pct(ok, rs.length)} (${ok}/${rs.length})${trials > 1 ? ` [${missed.length}]` : ''}`;
  });
  lines.push(`| ${m} | ${cells.join(' | ')} |`);
}

lines.push('', '## Accuracy by question kind', '');
for (const m of models) {
  lines.push(`**${m}**`, '', `| Kind | ${FORMATS.map((f) => f.toUpperCase()).join(' | ')} |`, `|---|${FORMATS.map(() => '--:').join('|')}|`);
  for (const k of kinds) {
    lines.push(`| ${k} | ${FORMATS.map((f) => { const [a, b] = summary[m][f].byKind[k]; return `${a}/${b}`; }).join(' | ')} |`);
  }
  lines.push('');
}

// Reading LWON can take the model more output (thinking) tokens, which cost more than
// input tokens. Compare the full cost of one question: once with the data at the normal
// input price (sent once), once at the cache-read price (the same data reused).
const costRows = models.map((m) => {
  const model = records_.find((r) => r.label === m)!.model;
  const p = PRICE[model] ?? [0, 0, 0, 0];
  const per = Object.fromEntries(FORMATS.map((f) => {
    const rs = records_.filter((r) => r.label === m && r.format === f && !r.error);
    const avg = (fn: (r: Record_) => number) => rs.reduce((s, r) => s + fn(r), 0) / (rs.length || 1);
    const input = avg((r) => r.usage.input + r.usage.cacheRead + r.usage.cacheWrite);
    const output = avg((r) => r.usage.output);
    return [f, { output, once: (input * p[0] + output * p[1]) / 1e6, cached: (input * p[2] + output * p[1]) / 1e6 }];
  })) as Record<Format, { output: number; once: number; cached: number }>;
  return { m, per };
});
const vs = (a: number, b: number) => { const d = Math.round((a / b - 1) * 100); return d > 0 ? `+${d}%` : `${d}%`; };
lines.push('## Output tokens and cost per question', '',
  'Average output tokens (including thinking), and the full cost of one question compared with JSON:',
  '"sent once" prices the data as normal input, "cached" as a cache read when the same data answers many questions.', '',
  '| Model | Output JSON | TOON | LWON | TOON sent once | LWON sent once | TOON cached | LWON cached |',
  '|---|--:|--:|--:|--:|--:|--:|--:|');
for (const { m, per } of costRows) {
  lines.push(`| ${m} | ${Math.round(per.json.output)} | ${Math.round(per.toon.output)} | ${Math.round(per.lwon.output)} | ${vs(per.toon.once, per.json.once)} | ${vs(per.lwon.once, per.json.once)} | ${vs(per.toon.cached, per.json.cached)} | ${vs(per.lwon.cached, per.json.cached)} |`);
}
lines.push('');

const misses = models.flatMap((m) => FORMATS.flatMap((f) =>
  records_.filter((r) => r.label === m && r.format === f && !r.correct).map((r) => ({ m, f, r }))));
if (misses.length) {
  lines.push('## Wrong answers', '', '| Model | Format | Question | Expected | Got |', '|---|---|---|---|---|');
  for (const { m, f, r } of misses.sort((a, b) => a.r.id.localeCompare(b.r.id, 'en', { numeric: true }))) {
    const q = questions.find((x) => x.id === r.id)!;
    lines.push(`| ${m} | ${f} | ${r.id} | ${q.answer} | ${r.error ? 'error' : JSON.stringify(r.answer)} |`);
  }
  lines.push('');
}

const tokFile = new URL(`tokens${suffix}.json`, import.meta.url);
const tokens = existsSync(tokFile) ? JSON.parse(readFileSync(tokFile, 'utf8')) : {};
// Models that share a tokenizer produce identical counts; show each distinct table once.
const groups = new Map<string, { models: string[]; data: any }>();
for (const [m, byDataset] of Object.entries<any>(tokens)) {
  const key = JSON.stringify(byDataset);
  if (groups.has(key)) groups.get(key)!.models.push(m);
  else groups.set(key, { models: [m], data: byDataset });
}
const signed = (a: number, b: number) => { const d = Math.round((a / b - 1) * 100); return d > 0 ? `+${d}%` : `${d}%`; };
for (const { models: ms, data } of groups.values()) {
  lines.push(`## Tokens (${ms.join(', ')})`, '',
    'Data only, then LWON with its primer as sent in the eval. Changes are against minified JSON.', '',
    '| Dataset | JSON | TOON | LWON | LWON vs JSON | LWON + primer | vs JSON |', '|---|--:|--:|--:|--:|--:|--:|');
  for (const [d, t] of Object.entries<any>(data)) {
    lines.push(`| ${d} | ${t.json.raw} | ${t.toon.raw} | ${t.lwon.raw} | ${signed(t.lwon.raw, t.json.raw)} | ${t.lwon.prompt} | ${signed(t.lwon.prompt, t.json.prompt)} |`);
  }
  lines.push('');
}

if (!dry) {
  lines.push('## Cost of this run', '', '| Model | ' + FORMATS.join(' | ') + ' |', `|---|${FORMATS.map(() => '--:').join('|')}|`);
  for (const m of models) lines.push(`| ${m} | ${FORMATS.map((f) => `$${summary[m][f].cost.toFixed(3)}`).join(' | ')} |`);
}

const md = lines.join('\n') + '\n';
writeFileSync(new URL(`EVAL${suffix}.md`, import.meta.url), md);
writeFileSync(new URL(`results${suffix}.json`, import.meta.url), JSON.stringify({ suite, trials, summary, perQuestion: Object.fromEntries(costRows.map((r) => [r.m, r.per])), tokens }, null, 2) + '\n');
console.log(md);
