// Questions about the benchmark datasets, with answers computed from the data.
// Kinds cover what a model must do with structured context: find a record,
// follow nesting, count or aggregate, walk a tree, and tell absent from null.
import { readFileSync } from 'node:fs';

export type Kind = 'lookup' | 'nested' | 'count' | 'aggregate' | 'tree' | 'absent';

export interface Question {
  id: string;
  dataset: string;
  kind: Kind;
  question: string;
  answer: string;
  /** How to compare: exact text, a number, or an unordered comma-separated list. */
  match: 'text' | 'number' | 'list';
}

type Row = Record<string, any>;
const load = (name: string): any => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

/** Picks rows at fixed fractions of the list so questions spread across the data. */
const spread = <T>(rows: T[], n: number): T[] =>
  Array.from({ length: n }, (_, i) => rows[Math.floor(((i + 0.5) * rows.length) / n)]);

const NONE = 'none';

export function buildQuestions(): Question[] {
  const qs: Question[] = [];
  const add = (dataset: string, kind: Kind, question: string, answer: unknown, match: Question['match'] = 'text') =>
    qs.push({ id: `${dataset}-${qs.filter((q) => q.dataset === dataset).length + 1}`, dataset, kind, question, answer: String(answer), match });

  // users: flat table
  const users: Row[] = load('users');
  for (const u of spread(users, 3)) add('users', 'lookup', `What is the email address of the user with id ${u.id}?`, u.email);
  for (const u of spread(users, 2)) add('users', 'lookup', `What is the role of the user with id ${u.id}?`, u.role);
  add('users', 'count', 'How many users have the role "admin"?', users.filter((u) => u.role === 'admin').length, 'number');
  add('users', 'count', 'How many users are not active?', users.filter((u) => !u.active).length, 'number');
  const top = users.reduce((a, b) => (b.score > a.score ? b : a));
  add('users', 'aggregate', 'What is the id of the user with the highest score?', top.id, 'number');

  // orders: nested objects and arrays
  const orders: Row[] = load('orders');
  for (const o of spread(orders, 2)) add('orders', 'nested', `In which city is the customer of order ${o.orderId}?`, o.customer.address.city);
  for (const o of spread(orders, 2)) {
    add('orders', 'aggregate', `What is the total quantity of all items in order ${o.orderId}?`, o.items.reduce((s: number, i: Row) => s + i.qty, 0), 'number');
  }
  const o3 = spread(orders, 3)[2];
  add('orders', 'nested', `What is the price of the first item in order ${o3.orderId}?`, o3.items[0].price, 'number');
  add('orders', 'count', 'How many orders have the status "refunded"?', orders.filter((o) => o.status === 'refunded').length, 'number');
  add('orders', 'count', 'How many orders have the tag "gift"?', orders.filter((o) => o.tags.includes('gift')).length, 'number');
  const noTags = orders.find((o) => o.tags.length === 0)!;
  add('orders', 'absent', `List the tags of order ${noTags.orderId}. If it has none, answer "${NONE}".`, NONE);

  // issues: nullable nested objects
  const issues: Row[] = load('issues');
  for (const i of spread(issues, 2)) add('issues', 'nested', `What is the login of the user who opened issue ${i.number}?`, i.user.login);
  const assigned = issues.find((i) => i.assignee)!;
  const unassigned = issues.find((i) => i.assignee === null)!;
  add('issues', 'nested', `What is the login of the assignee of issue ${assigned.number}? If there is none, answer "${NONE}".`, assigned.assignee.login);
  add('issues', 'absent', `What is the login of the assignee of issue ${unassigned.number}? If there is none, answer "${NONE}".`, NONE);
  add('issues', 'count', 'How many issues have no assignee?', issues.filter((i) => i.assignee === null).length, 'number');
  add('issues', 'count', 'How many issues are open?', issues.filter((i) => i.state === 'open').length, 'number');
  const labelled = issues.find((i) => new Set(i.labels.map((l: Row) => l.name)).size >= 2)!;
  add('issues', 'nested', `List the label names of issue ${labelled.number}, separated by commas.`, [...new Set(labelled.labels.map((l: Row) => l.name))].join(', '), 'list');
  add('issues', 'count', 'How many issues have the label "bug"?', issues.filter((i) => i.labels.some((l: Row) => l.name === 'bug')).length, 'number');

  // menu: recursive tree
  const menu: Row[] = load('menu');
  const nodes: { node: Row; parent: Row | null; depth: number }[] = [];
  const walk = (list: Row[], parent: Row | null, depth: number) =>
    list.forEach((n) => { nodes.push({ node: n, parent, depth }); walk(n.children, n, depth + 1); });
  walk(menu, null, 1);
  add('menu', 'count', 'How many sections are there in total, at every level?', nodes.length, 'number');
  add('menu', 'count', 'How many top-level sections are there?', menu.length, 'number');
  const deep = nodes.filter((n) => n.depth === 3);
  for (const d of spread(deep, 2)) add('menu', 'tree', `What is the title of the parent of the section with path ${d.node.path}?`, d.parent!.title);
  const mid = nodes.filter((n) => n.depth === 2)[1];
  add('menu', 'tree', `How many direct children does "${mid.node.title}" have?`, mid.node.children.length, 'number');
  add('menu', 'lookup', `What is the path of "${deep.at(-1)!.node.title}"?`, deep.at(-1)!.node.path);
  add('menu', 'tree', `What is the title of the top-level section that contains "${deep[0].node.title}"?`, nodes.find((n) => n.node === deep[0].parent)!.parent!.title);

  // logs: optional fields
  const logs: Row[] = load('logs');
  add('logs', 'count', 'How many log events have the level "error"?', logs.filter((e) => e.level === 'error').length, 'number');
  add('logs', 'count', 'How many log events have a userId?', logs.filter((e) => 'userId' in e).length, 'number');
  const err = logs.find((e) => e.level === 'error' && e.requestId)!;
  add('logs', 'nested', `What is the error code of the event with requestId ${err.requestId}?`, err.error.code);
  const withUser = logs.find((e) => e.requestId && 'userId' in e)!;
  const withoutUser = logs.find((e) => e.requestId && !('userId' in e))!;
  add('logs', 'lookup', `What is the userId of the event with requestId ${withUser.requestId}? If it has none, answer "${NONE}".`, withUser.userId);
  add('logs', 'absent', `What is the userId of the event with requestId ${withoutUser.requestId}? If it has none, answer "${NONE}".`, NONE);
  const noDuration = logs.find((e) => e.requestId && !('durationMs' in e))!;
  add('logs', 'absent', `What is the durationMs of the event with requestId ${noDuration.requestId}? If it has none, answer "${NONE}".`, NONE);
  const withDuration = logs.find((e) => e.requestId && 'durationMs' in e)!;
  add('logs', 'lookup', `What is the durationMs of the event with requestId ${withDuration.requestId}? If it has none, answer "${NONE}".`, withDuration.durationMs, 'number');

  // search: object root with a result list and long text
  const search: Row = load('search');
  for (const r of spread(search.results as Row[], 2)) add('search', 'lookup', `What is the URL of the result ranked ${r.rank}?`, r.url);
  const best = (search.results as Row[]).reduce((a, b) => (b.score > a.score ? b : a));
  add('search', 'aggregate', 'What is the rank of the result with the highest score?', best.rank, 'number');
  add('search', 'count', 'How many results are in the language "tr"?', search.results.filter((r: Row) => r.meta.lang === 'tr').length, 'number');
  const r5 = search.results[4];
  add('search', 'nested', `What is the publication date of the result ranked ${r5.rank}? Answer with the exact value.`, r5.meta.published);
  add('search', 'lookup', 'What was the search query?', search.query);

  return qs;
}

// --- Scoring ---------------------------------------------------------------

const norm = (s: string) => s.trim().replace(/^["'`]+|["'`.]+$/g, '').trim().toLowerCase();

export function isCorrect(q: Question, raw: string | null): boolean {
  if (raw === null) return false;
  const got = norm(raw);
  const want = norm(q.answer);
  if (q.match === 'number') {
    const n = Number(got.replace(/,/g, ''));
    return Number.isFinite(n) && n === Number(want);
  }
  if (q.match === 'list') {
    const set = (s: string) => s.split(/\s*,\s*/).map(norm).filter(Boolean).sort().join('|');
    return set(got) === set(want);
  }
  return got === want;
}

/** The text inside <answer>…</answer>, or null when the model gave none. */
export function extractAnswer(text: string): string | null {
  const m = text.match(/<answer>([\s\S]*?)<\/answer>/i);
  return m ? m[1] : null;
}
