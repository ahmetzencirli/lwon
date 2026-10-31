// Summarises bench/eval/runs/*.jsonl and tokens.json into EVAL.md and results.json.
//   node bench/eval/report.ts [--dry]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { costOf, FORMATS, type Format, type Record_ } from './eval.ts';
import { buildQuestions } from './questions.ts';

const dry = process.argv.includes('--dry');
const runsDir = new URL('runs/', import.meta.url);
const files = existsSync(runsDir)
  ? readdirSync(runsDir).filter((f) => f.endsWith('.jsonl') && f.startsWith('dry-') === dry)
  : [];

// Latest record per model/format/question wins, so re-runs replace errors.
const latest = new Map<string, Record_>();
for (const f of files) {
  for (const line of readFileSync(new URL(f, runsDir), 'utf8').split('\n').filter(Boolean)) {
    const r: Record_ = JSON.parse(line);
    // Label runs by model and, when not the default, by effort.
    const label = r.effort && r.effort !== 'medium' ? `${r.model} (effort ${r.effort})` : r.model;
    latest.set(`${label}/${r.format}/${r.id}`, { ...r, label } as Record_ & { label: string });
  }
}
const records = [...latest.values()];
const records_ = records as (Record_ & { label: string })[];
const models = [...new Set(records_.map((r) => r.label))].sort();
const kinds = [...new Set(buildQuestions().map((q) => q.kind))];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

const cost = (rs: Record_[]) => rs.reduce((s, r) => s + costOf(r), 0);

const lines: string[] = ['# Comprehension eval', ''];
lines.push(
  `${buildQuestions().length} questions about six datasets, asked once per format. Each answer is compared with`,
  'a value computed from the data. JSON is minified; LWON is sent with its primer; TOON gets a one-line label.',
  '',
  '## Accuracy',
  '',
  `| Model | ${FORMATS.map((f) => f.toUpperCase()).join(' | ')} |`,
  `|---|${FORMATS.map(() => '--:').join('|')}|`,
);
const summary: Record<string, Record<Format, { correct: number; total: number; errors: number; cost: number; byKind: Record<string, [number, number]> }>> = {};
for (const m of models) {
  summary[m] = {} as (typeof summary)[string];
  const cells = FORMATS.map((f) => {
    const rs = records_.filter((r) => r.label === m && r.format === f);
    const ok = rs.filter((r) => r.correct).length;
    const byKind = Object.fromEntries(kinds.map((k) => {
      const kr = rs.filter((r) => r.kind === k);
      return [k, [kr.filter((r) => r.correct).length, kr.length] as [number, number]];
    }));
    summary[m][f] = { correct: ok, total: rs.length, errors: rs.filter((r) => r.error).length, cost: cost(rs), byKind };
    return `${pct(ok, rs.length)} (${ok}/${rs.length})`;
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

const tokFile = new URL(dry ? 'tokens-dry.json' : 'tokens.json', import.meta.url);
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
writeFileSync(new URL(dry ? 'EVAL-dry.md' : 'EVAL.md', import.meta.url), md);
writeFileSync(new URL(dry ? 'results-dry.json' : 'results.json', import.meta.url), JSON.stringify({ summary, tokens }, null, 2) + '\n');
console.log(md);
