import { isBareKey, writeHeader, type Field, type Header, type Kind, type Shape } from './shape.ts';
import type { Json } from './decode.ts';

export interface EncodeOptions {
  /** Write strings without quotes when they are bare words. Default: true. */
  bareStrings?: boolean;
}

type Obj = { [key: string]: Json };

const BARE_WORD = /^[\p{L}_][^\s[\]{}"\\,~\p{Cc}]*$/u;
/** Below this share of filled slots, a position is written as JSON instead of records. */
const MIN_FILL = 0.3;

/** Encodes any JSON-serializable value as an LWON document. */
export function encode(value: unknown, options: EncodeOptions = {}): string {
  const text = JSON.stringify(value);
  if (text === undefined) throw new TypeError('Value is not JSON-serializable');
  const data = JSON.parse(text) as Json;
  const w = new Writer(options.bareStrings ?? true);

  const header = inferHeader(data);
  const head = writeHeader(header);
  if (header.root === 'any') return `${head}\n${w.any(data)}`;
  if (header.root === 'object') return `${head}\n${w.record(data as Obj, header.shape, true)}`;
  const rows = (data as Json[]).map((row) => w.row(row, header.shape));
  return `${head}\n[\n${rows.join('\n')}\n]`;
}

// --- Inference -------------------------------------------------------------

export function inferHeader(data: Json): Header {
  if (Array.isArray(data) && data.some(isObj) && !data.some(Array.isArray)) {
    const objs = data.filter(isObj);
    const keys = unionKeys(objs);
    if (keys.length > 0 && fill(objs, keys) >= MIN_FILL) return { root: 'table', shape: inferRoot(objs) };
  }
  if (isObj(data) && Object.keys(data).length > 0) {
    return { root: 'object', shape: inferRoot([data]) };
  }
  return { root: 'any' };
}

interface PendingRef {
  path: string;
  kind: 'object' | 'rows';
  shape: Shape;
  values: Json[];
}

/**
 * Infers the root shape. A reference to an ancestor shape is a guess made before
 * that ancestor is complete, so each one is checked afterwards; a reference that
 * does not fit is blocked and inference runs again.
 */
function inferRoot(objs: Obj[]): Shape {
  const blocked = new Set<string>();
  for (;;) {
    const pending: PendingRef[] = [];
    const root = inferShape(objs, '', [], '', blocked, pending);
    const bad = pending.find((ref) => !ref.values.every((v) => fits(v, ref.kind, ref.shape)));
    if (!bad) return root;
    blocked.add(bad.path);
  }
}

function inferShape(
  objs: Obj[], name: string, stack: Shape[], path: string,
  blocked: Set<string>, pending: PendingRef[],
): Shape {
  const keys = unionKeys(objs);
  const shape: Shape = { name, keys, fields: [] };
  const inner = [...stack, shape];
  for (const key of keys) {
    const values: Json[] = [];
    for (const o of objs) if (Object.hasOwn(o, key)) values.push(o[key]);
    shape.fields.push(inferField(key, values, inner, `${path}/${JSON.stringify(key)}`, blocked, pending));
  }
  return shape;
}

function inferField(
  key: string, values: Json[], stack: Shape[], path: string,
  blocked: Set<string>, pending: PendingRef[],
): Field {
  const objs = values.filter(isObj);
  const arrays = values.filter(Array.isArray);
  if (objs.length && arrays.length) return { key, kind: 'any' };

  let kind: 'object' | 'rows';
  let samples: Obj[];
  if (objs.length) {
    kind = 'object';
    samples = objs;
  } else if (arrays.length) {
    const elements = arrays.flat(1);
    samples = elements.filter(isObj);
    if (!samples.length || elements.some(Array.isArray)) return { key, kind: 'list' };
    kind = 'rows';
  } else {
    return { key, kind: 'any' };
  }

  const fallback: Kind = kind === 'rows' ? 'list' : 'any';
  const keys = unionKeys(samples);
  if (keys.length === 0 || fill(samples, keys) < MIN_FILL) return { key, kind: fallback };

  const ref = blocked.has(path) ? undefined : findAncestor(keys, stack);
  if (ref) {
    pending.push({ path, kind, shape: ref, values });
    return { key, kind, shape: ref };
  }
  return { key, kind, shape: inferShape(samples, key, stack, path, blocked, pending) };
}

/** The nearest enclosing shape these keys can reuse, if any. */
function findAncestor(keys: string[], stack: Shape[]): Shape | undefined {
  for (let j = stack.length - 1; j >= 0; j--) {
    const s = stack[j];
    if (j > 0) {
      if (!isBareKey(s.name)) continue;
      // A reference names its target, so a nearer shape with the same name hides it.
      if (stack.slice(j + 1).some((t) => t.name === s.name)) continue;
    }
    if (keys.length < s.keys.length - 1) continue;
    if (keys.every((k) => s.keys.includes(k))) return s;
  }
  return undefined;
}

/** Whether a value can be written at a position of this kind without loss. */
function fits(v: Json, kind: Kind, shape?: Shape): boolean {
  if (kind === 'any' || kind === 'list') return true;
  if (kind === 'object') return Array.isArray(v) ? false : !isObj(v) || fitsRecord(v, shape!);
  if (!Array.isArray(v)) return true;
  return v.every((e) => !Array.isArray(e) && (!isObj(e) || fitsRecord(e, shape!)));
}

function fitsRecord(o: Obj, shape: Shape): boolean {
  if (!asRecord(o, shape)) return true; // written as embedded JSON
  return shape.fields.every((f) => !Object.hasOwn(o, f.key) || fits(o[f.key], f.kind, f.shape));
}

/** Whether an object is written as a record of this shape (otherwise as embedded JSON). */
function asRecord(o: Obj, shape: Shape): boolean {
  const keys = Object.keys(o);
  return keys.length > 0 && keys.every((k) => shape.keys.includes(k));
}

function unionKeys(objs: Obj[]): string[] {
  const seen = new Set<string>();
  for (const o of objs) for (const k of Object.keys(o)) seen.add(k);
  return [...seen];
}

function fill(objs: Obj[], keys: string[]): number {
  if (objs.length < 2) return 1;
  let filled = 0;
  for (const o of objs) filled += Object.keys(o).length;
  return filled / (objs.length * keys.length);
}

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// --- Writing ---------------------------------------------------------------

class Writer {
  readonly bareStrings: boolean;

  constructor(bareStrings: boolean) {
    this.bareStrings = bareStrings;
  }

  /** `lines` puts each row of a rows value on its own line, as in a root table. */
  value(v: Json, kind: Kind, shape?: Shape, lines = false): string {
    if (kind === 'any') return this.any(v);
    if (Array.isArray(v)) {
      if (kind === 'object') throw new Error('LWON internal error: array in an object position');
      const items = kind === 'list'
        ? v.map((e) => this.any(e))
        : v.map((e) => this.row(e, shape!));
      return lines && kind === 'rows' && items.length > 1 ? `[\n${items.join('\n')}\n]` : `[${items.join(' ')}]`;
    }
    if (isObj(v)) return kind === 'object' ? this.row(v, shape!) : JSON.stringify(v);
    return this.primitive(v);
  }

  row(v: Json, shape: Shape): string {
    if (Array.isArray(v)) throw new Error('LWON internal error: array in a record position');
    if (!isObj(v)) return this.primitive(v);
    return asRecord(v, shape) ? this.record(v, shape) : JSON.stringify(v);
  }

  record(o: Obj, shape: Shape, lines = false): string {
    const parts = shape.fields.map((f) => (Object.hasOwn(o, f.key) ? this.value(o[f.key], f.kind, f.shape, lines) : '~'));
    while (parts.at(-1) === '~') parts.pop();
    return `[${parts.join(' ')}]`;
  }

  any(v: Json): string {
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : this.primitive(v);
  }

  primitive(v: null | boolean | number | string): string {
    if (typeof v !== 'string') return JSON.stringify(v);
    if (this.bareStrings && BARE_WORD.test(v) && v !== 'null' && v !== 'true' && v !== 'false') return v;
    return JSON.stringify(v);
  }
}
