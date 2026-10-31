import { LwonError, readHeader, skipString, type Kind, type Shape } from './shape.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const WORD_START = /[\p{L}_]/u;
const DELIMITER = /[\s,[\]{}"]/;

/** Parses an LWON document into the JSON value it describes. */
export function decode(src: string): Json {
  const { header, end } = readHeader(src);
  const r = new Reader(src, end);
  let value: Json;
  if (header.root === 'any') value = r.any();
  else if (header.root === 'object') value = r.value('object', header.shape);
  else value = r.table(header.shape);
  r.ws();
  if (r.i < src.length) r.fail('Unexpected content after the body');
  return value;
}

class Reader {
  readonly src: string;
  i: number;

  constructor(src: string, i: number) {
    this.src = src;
    this.i = i;
  }

  fail(msg: string, at = this.i): never {
    throw new LwonError(msg, this.src, at);
  }

  /** Skips whitespace and commas. Returns the next character, or '' at the end. */
  ws(): string {
    const s = this.src;
    while (this.i < s.length && (s[this.i] === ',' || /\s/.test(s[this.i]))) this.i++;
    return s[this.i] ?? '';
  }

  table(shape: Shape): Json[] {
    if (this.ws() !== '[') this.fail("Expected '[' to open the table body");
    this.i++;
    const rows: Json[] = [];
    while (this.ws() !== ']') {
      if (this.i >= this.src.length) this.fail("Expected ']' to close the table body");
      rows.push(this.row(shape));
    }
    this.i++;
    return rows;
  }

  value(kind: Kind, shape?: Shape): Json {
    const c = this.ws();
    if (kind === 'any') return this.any();
    if (c === '{') return this.json();
    if (c !== '[') return this.primitive();
    if (kind === 'object') return this.record(shape!);
    this.i++;
    const out: Json[] = [];
    while (this.ws() !== ']') {
      if (this.i >= this.src.length) this.fail("Expected ']' to close the array");
      out.push(kind === 'list' ? this.any() : this.row(shape!));
    }
    this.i++;
    return out;
  }

  row(shape: Shape): Json {
    const c = this.ws();
    if (c === '[') return this.record(shape);
    if (c === '{') return this.json();
    return this.primitive();
  }

  record(shape: Shape): Json {
    const start = this.i;
    this.i++;
    const obj: { [key: string]: Json } = {};
    let n = 0;
    while (this.ws() !== ']') {
      if (this.i >= this.src.length) this.fail("Expected ']' to close the record", start);
      if (n >= shape.fields.length) {
        this.fail(`Record has more values than the ${shape.fields.length} fields in its header`);
      }
      const f = shape.fields[n++];
      if (this.src[this.i] === '~' && this.atDelimiter(this.i + 1)) {
        this.i++;
        continue;
      }
      setKey(obj, f.key, this.value(f.kind, f.shape));
    }
    this.i++;
    return obj;
  }

  any(): Json {
    const c = this.ws();
    if (c === '{' || c === '[') return this.json();
    return this.primitive();
  }

  primitive(): Json {
    const s = this.src;
    const start = this.i;
    const c = s[start];
    if (c === undefined) this.fail('Unexpected end of input');
    if (c === '"') {
      this.i = skipString(s, start);
      return this.parseJson(start, this.i) as string;
    }
    if (c === '~') this.fail("'~' (absent) is only allowed inside a record");
    while (this.i < s.length && !DELIMITER.test(s[this.i])) this.i++;
    const word = s.slice(start, this.i);
    if (word === '') this.fail(`Unexpected '${c}'`);
    if (word === 'null') return null;
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (NUMBER.test(word)) return Number(word);
    if (WORD_START.test(word[0])) return word;
    return this.fail(`Invalid value '${word}'`, start);
  }

  /** Reads one embedded JSON object or array. */
  json(): Json {
    const s = this.src;
    const start = this.i;
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (c === '"') i = skipString(s, i) - 1;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        if (--depth === 0) {
          this.i = i + 1;
          return this.parseJson(start, this.i);
        }
      }
    }
    return this.fail('Unterminated embedded JSON', start);
  }

  parseJson(start: number, end: number): Json {
    try {
      return JSON.parse(this.src.slice(start, end));
    } catch (e) {
      return this.fail(`Invalid embedded JSON: ${(e as Error).message}`, start);
    }
  }

  atDelimiter(i: number): boolean {
    return i >= this.src.length || DELIMITER.test(this.src[i]);
  }
}

function setKey(obj: { [key: string]: Json }, key: string, value: Json): void {
  if (key === '__proto__') {
    Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
  } else {
    obj[key] = value;
  }
}
