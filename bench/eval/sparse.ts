// The "sparse" suite: 150 log events where most fields are optional and some are
// null, so a reader must tell a missing key from a null one and count across rows
// with gaps. This is the case where LWON writes `~` or stops a row early, and where
// the first eval saw its only miss.
import type { Question } from './questions.ts';

type Event = Record<string, any>;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sparseData(): Event[] {
  const r = rng(7);
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  const int = (n: number) => Math.floor(r() * n);
  return Array.from({ length: 150 }, (_, i) => {
    const level = pick(['info', 'info', 'info', 'warn', 'error', 'debug']);
    const e: Event = {
      id: i + 1,
      ts: new Date(Date.UTC(2026, 9, 1, 0, 0) + i * 61_000).toISOString(),
      level,
      service: pick(['api', 'web', 'worker', 'db']),
    };
    if (r() < 0.55) e.userId = r() < 0.15 ? null : 1000 + int(9000);
    if (r() < 0.6) e.requestId = `req-${10000 + i * 7}`;
    if (r() < 0.45) e.durationMs = 5 + int(3000);
    if (r() < 0.5) e.region = r() < 0.12 ? null : pick(['eu', 'us', 'ap']);
    if (r() < 0.2) e.retry = 1 + int(3);
    if (r() < 0.4) {
      const u: Event = { id: 1 + int(500) };
      if (r() < 0.7) u.plan = pick(['free', 'pro', 'team']);
      if (r() < 0.4) u.org = r() < 0.2 ? null : pick(['acme', 'globex', 'initech', 'umbrella']);
      e.user = u;
    }
    if (r() < 0.5) e.tags = Array.from({ length: int(3) }, () => pick(['slow', 'retry', 'cache', 'auth', 'beta']));
    if (level === 'error') e.error = { code: pick(['E_TIMEOUT', 'E_DB', 'E_AUTH', 'E_RATE']), retryable: r() < 0.5 };
    return e;
  });
}

const BASE = new Set(['id', 'ts', 'level', 'service']);
const has = (o: Event, k: string) => Object.hasOwn(o, k);
/** "absent", "null", or the value as text. */
const state = (o: Event | undefined, k: string) => (!o || !has(o, k) ? 'absent' : o[k] === null ? 'null' : String(o[k]));
const RULE = 'If the key is not in the event at all, answer "absent". If the key is there with the value null, answer "null".';

export function buildSparseQuestions(): Question[] {
  const ev = sparseData();
  const qs: Question[] = [];
  const add = (kind: Question['kind'], question: string, answer: unknown, match: Question['match'] = 'text') =>
    qs.push({ id: `sparse-${qs.length + 1}`, dataset: 'sparse', kind, question, answer: String(answer), match });
  const count = (f: (e: Event) => boolean) => ev.filter(f).length;

  // Counting across rows with gaps.
  add('count', 'How many events include the key "userId", with any value including null?', count((e) => has(e, 'userId')), 'number');
  add('count', 'How many events have "userId" set to null?', count((e) => has(e, 'userId') && e.userId === null), 'number');
  add('count', 'How many events do not include the key "durationMs" at all?', count((e) => !has(e, 'durationMs')), 'number');
  add('count', 'How many events include the key "retry"?', count((e) => has(e, 'retry')), 'number');
  add('count', 'How many events with level "error" include the key "requestId"?', count((e) => e.level === 'error' && has(e, 'requestId')), 'number');
  add('count', 'How many events have "region" equal to "eu"?', count((e) => e.region === 'eu'), 'number');
  add('count', 'How many events from the service "worker" do not include the key "region"?', count((e) => e.service === 'worker' && !has(e, 'region')), 'number');
  add('count', 'How many events have a "user" whose "plan" is "pro"?', count((e) => e.user?.plan === 'pro'), 'number');
  add('count', 'How many events have a "user" object that does not include the key "plan"?', count((e) => has(e, 'user') && !has(e.user, 'plan')), 'number');
  add('count', 'How many events have a "tags" list with at least one tag?', count((e) => Array.isArray(e.tags) && e.tags.length > 0), 'number');
  const dbDur = ev.filter((e) => e.service === 'db' && typeof e.durationMs === 'number').reduce((s, e) => s + e.durationMs, 0);
  add('aggregate', 'What is the sum of "durationMs" over all events from the service "db" that have a durationMs?', dbDur, 'number');

  // Reading one row with gaps, late in the list. Mix present, absent and null answers.
  const late = ev.slice(100);
  const pickWhere = (f: (e: Event) => boolean, nth = 0) => late.filter(f)[nth];
  const cases: [Event, string][] = [
    [pickWhere((e) => typeof e.durationMs === 'number' && !has(e, 'userId')), 'durationMs'],
    [pickWhere((e) => !has(e, 'durationMs') && has(e, 'retry')), 'durationMs'],
    [pickWhere((e) => has(e, 'userId') && e.userId === null), 'userId'],
    [pickWhere((e) => typeof e.userId === 'number' && !has(e, 'requestId')), 'userId'],
    [pickWhere((e) => has(e, 'region') && e.region === null), 'region'],
    [pickWhere((e) => !has(e, 'region') && has(e, 'tags')), 'region'],
  ];
  for (const [e, k] of cases) add('absent', `What is the value of "${k}" in the event with id ${e.id}? ${RULE}`, state(e, k));

  const orgCases = [
    pickWhere((e) => typeof e.user?.org === 'string'),
    pickWhere((e) => has(e, 'user') && !has(e.user, 'org') && has(e.user, 'plan')),
    pickWhere((e) => has(e, 'user') && has(e.user, 'org') && e.user.org === null),
  ];
  for (const e of orgCases) add('absent', `What is the value of "org" inside "user" in the event with id ${e.id}? ${RULE}`, state(e.user, 'org'));

  const rows = [pickWhere((e) => Object.keys(e).length >= 8), pickWhere((e) => Object.keys(e).length <= 5, 1)];
  for (const e of rows) {
    const keys = Object.keys(e).filter((k) => !BASE.has(k));
    add('absent', `List every key in the event with id ${e.id} other than id, ts, level and service, separated by commas. Answer "none" if there are none.`, keys.length ? keys.join(', ') : 'none', 'list');
  }
  return qs;
}
