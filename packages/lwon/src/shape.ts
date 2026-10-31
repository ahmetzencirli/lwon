// The header model: a tree of shapes that may point back at an ancestor (recursion).

export type Kind = 'any' | 'object' | 'list' | 'rows';

export interface Field {
  key: string;
  kind: Kind;
  /** Inner fields of an `object` or `rows` field. May be an ancestor shape. */
  shape?: Shape;
}

export interface Shape {
  /** The key that introduced this shape; '' for the root, which is always referenced as `@`. */
  name: string;
  keys: string[];
  fields: Field[];
}

export type Header =
  | { root: 'table'; shape: Shape }
  | { root: 'object'; shape: Shape }
  | { root: 'any' };

export class LwonError extends Error {
  readonly offset: number;
  readonly line: number;
  readonly column: number;

  constructor(message: string, source = '', offset = 0) {
    const before = source.slice(0, offset);
    const line = before.split('\n').length;
    const column = offset - before.lastIndexOf('\n');
    super(source ? `${message} (line ${line}, column ${column})` : message);
    this.name = 'LwonError';
    this.offset = offset;
    this.line = line;
    this.column = column;
  }
}

const BARE_KEY = /^[\p{L}\p{N}_$][\p{L}\p{N}_$.\-]*$/u;
const KEY_CHAR = /[\p{L}\p{N}_$.\-]/u;

export function isBareKey(key: string): boolean {
  return BARE_KEY.test(key);
}

export function writeKey(key: string): string {
  return isBareKey(key) ? key : JSON.stringify(key);
}

export function makeShape(name: string, fields: Field[]): Shape {
  return { name, keys: fields.map((f) => f.key), fields };
}

// --- Writing ---------------------------------------------------------------

export function writeHeader(header: Header): string {
  if (header.root === 'any') return '*';
  const fields = writeFields(header.shape.fields, [header.shape]);
  return header.root === 'object' ? `{${fields}}` : fields;
}

function writeFields(fields: Field[], stack: Shape[]): string {
  return fields.map((f) => writeField(f, stack)).join(' ');
}

function writeField(f: Field, stack: Shape[]): string {
  const key = writeKey(f.key);
  if (f.kind === 'any') return key;
  if (f.kind === 'list') return `[${key}]`;

  const shape = f.shape!;
  const isRef = stack.includes(shape);
  if (isRef && shape !== stack[0] && f.kind === 'rows' && shape.name === f.key) return `[@${key}]`;
  const inner = isRef
    ? shape === stack[0] ? '@' : `@${shape.name}`
    : writeFields(shape.fields, [...stack, shape]);
  return f.kind === 'object' ? `${key}[${inner}]` : `[${key}[${inner}]]`;
}

// --- Reading ---------------------------------------------------------------

type Token =
  | { t: '[' | ']' | '{' | '}' | '*'; at: number; space: boolean }
  | { t: 'key'; value: string; at: number; space: boolean }
  | { t: 'ref'; value: string; at: number; space: boolean };

/** Returns the offset just past the header: the first line break outside brackets. */
export function headerEnd(src: string): number {
  let depth = 0;
  let seen = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      i = skipString(src, i) - 1;
      seen = true;
    } else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === '\n' && depth <= 0 && seen) return i;
    if (!/\s/.test(c)) seen = true;
  }
  return src.length;
}

/** Given the offset of an opening quote, returns the offset just past the closing quote. */
export function skipString(src: string, start: number): number {
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === '\\') i++;
    else if (src[i] === '"') return i + 1;
  }
  throw new LwonError('Unterminated string', src, start);
}

function tokenizeHeader(src: string, end: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let space = true;
  while (i < end) {
    const c = src[i];
    if (/\s/.test(c)) { space = true; i++; continue; }
    const at = i;
    if (c === '[' || c === ']' || c === '{' || c === '}' || c === '*') {
      tokens.push({ t: c, at, space });
      i++;
    } else if (c === '"') {
      i = skipString(src, i);
      tokens.push({ t: 'key', value: JSON.parse(src.slice(at, i)), at, space });
    } else if (c === '@' || KEY_CHAR.test(c)) {
      i++;
      while (i < end && KEY_CHAR.test(src[i])) i++;
      const word = src.slice(at, i);
      if (c === '@') tokens.push({ t: 'ref', value: word.slice(1), at, space });
      else tokens.push({ t: 'key', value: word, at, space });
    } else {
      throw new LwonError(`Unexpected '${c}' in header`, src, at);
    }
    space = false;
  }
  return tokens;
}

export function readHeader(src: string): { header: Header; end: number } {
  const end = headerEnd(src);
  const tokens = tokenizeHeader(src, end);
  let p = 0;

  const fail = (msg: string, tok = tokens[p]): never => {
    throw new LwonError(msg, src, tok ? tok.at : end);
  };
  const expect = (t: Token['t']) => {
    if (tokens[p]?.t !== t) fail(`Expected '${t}' in header`);
    p++;
  };

  const resolve = (tok: Token & { t: 'ref' }, stack: Shape[]): Shape => {
    if (tok.value === '') return stack[0];
    for (let j = stack.length - 1; j >= 1; j--) if (stack[j].name === tok.value) return stack[j];
    return fail(`Unknown reference '@${tok.value}'`, tok);
  };

  // Inner fields after `key[`: either a reference or a new shape. Consumes the closing `]`.
  const readSub = (name: string, stack: Shape[]): Shape => {
    const tok = tokens[p];
    let shape: Shape;
    if (tok?.t === 'ref' && tokens[p + 1]?.t === ']') {
      p++;
      shape = resolve(tok, stack);
    } else {
      shape = { name, keys: [], fields: [] };
      readFields(shape, [...stack, shape], ']');
    }
    expect(']');
    return shape;
  };

  const readFields = (shape: Shape, stack: Shape[], closer: ']' | '}' | null) => {
    while (p < tokens.length && tokens[p].t !== closer) {
      const tok = tokens[p];
      if (tok.t === 'key') {
        p++;
        const next = tokens[p];
        if (next?.t === '[' && !next.space) {
          p++;
          shape.fields.push({ key: tok.value, kind: 'object', shape: readSub(tok.value, stack) });
        } else {
          shape.fields.push({ key: tok.value, kind: 'any' });
        }
      } else if (tok.t === '[') {
        p++;
        const inner = tokens[p];
        if (inner?.t === 'ref') {
          p++;
          if (inner.value === '') fail("'[@]' needs a field name; write '[key[@]]'", inner);
          expect(']');
          shape.fields.push({ key: inner.value, kind: 'rows', shape: resolve(inner, stack) });
        } else if (inner?.t === 'key') {
          p++;
          const next = tokens[p];
          if (next?.t === '[' && !next.space) {
            p++;
            const sub = readSub(inner.value, stack);
            expect(']');
            shape.fields.push({ key: inner.value, kind: 'rows', shape: sub });
          } else {
            expect(']');
            shape.fields.push({ key: inner.value, kind: 'list' });
          }
        } else {
          fail("Expected a key after '['");
        }
      } else {
        fail(`Unexpected '${tok.t === 'ref' ? '@' + tok.value : tok.t}' in header`);
      }
    }
    shape.keys = shape.fields.map((f) => f.key);
    const seen = new Set<string>();
    for (const k of shape.keys) {
      if (seen.has(k)) fail(`Duplicate key ${JSON.stringify(k)} in header`);
      seen.add(k);
    }
  };

  if (tokens.length === 0) fail('Missing header');
  let header: Header;
  if (tokens[0].t === '*') {
    if (tokens.length > 1) fail("Unexpected token after '*'", tokens[1]);
    header = { root: 'any' };
  } else if (tokens[0].t === '{') {
    p = 1;
    const shape: Shape = { name: '', keys: [], fields: [] };
    readFields(shape, [shape], '}');
    expect('}');
    if (p < tokens.length) fail("Unexpected token after '}'");
    header = { root: 'object', shape };
  } else {
    const shape: Shape = { name: '', keys: [], fields: [] };
    readFields(shape, [shape], null);
    header = { root: 'table', shape };
  }
  return { header, end };
}
