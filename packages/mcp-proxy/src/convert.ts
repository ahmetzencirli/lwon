import { encode } from '@lwon/core';

export interface ConvertOptions {
  /** Text shorter than this many characters stays JSON. Default: 2000. */
  minChars?: number;
  /** Convert only these tools. Names may use `*` as a wildcard. Default: every tool. */
  tools?: string[];
  /** Never convert these tools. Names may use `*` as a wildcard. */
  skipTools?: string[];
}

export interface Conversion {
  /** The result to send on: the same object when nothing was converted. */
  result: Record<string, unknown>;
  /** Text blocks that were converted. */
  converted: number;
  /** Characters of the converted blocks before conversion. */
  before: number;
  /** Characters of the converted blocks after conversion. */
  after: number;
}

/**
 * About 330 Claude tokens of primer explain the format once per session, so a
 * result needs to be a few hundred tokens long before converting it is worth it.
 */
export const DEFAULT_MIN_CHARS = 2000;
/** LWON must be at least this much shorter than the original text, or the text stays as it is. */
const MIN_SAVING = 0.1;

/** Whether results of `tool` may be converted under `options`. */
export function toolSelected(tool: string, options: ConvertOptions): boolean {
  if (options.skipTools?.some((p) => matches(p, tool))) return false;
  if (!options.tools?.length) return true;
  return options.tools.some((p) => matches(p, tool));
}

function matches(pattern: string, name: string): boolean {
  if (!pattern.includes('*')) return pattern === name;
  const re = pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${re}$`).test(name);
}

/** LWON for `text` when it is JSON and converting it saves enough, otherwise undefined. */
export function convertText(text: string, minChars = DEFAULT_MIN_CHARS): string | undefined {
  if (text.length < minChars) return undefined;
  const start = text.trimStart()[0];
  if (start !== '{' && start !== '[') return undefined;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  const lwon = encode(data);
  return lwon.length <= text.length * (1 - MIN_SAVING) ? lwon : undefined;
}

/**
 * Rewrites the JSON text blocks of a `tools/call` result as LWON. Errors, results
 * that ask for more input, images and other non-text blocks, non-JSON text and
 * text below the size threshold pass through unchanged, and so does
 * `structuredContent`, which clients read as data rather than show the model.
 */
export function convertToolResult(result: Record<string, unknown>, options: ConvertOptions = {}): Conversion {
  const none: Conversion = { result, converted: 0, before: 0, after: 0 };
  if (result.isError === true || !Array.isArray(result.content)) return none;
  if (result.resultType !== undefined && result.resultType !== 'complete') return none;

  let converted = 0;
  let before = 0;
  let after = 0;
  const content = result.content.map((block: unknown) => {
    if (!isTextBlock(block)) return block;
    const lwon = convertText(block.text, options.minChars);
    if (lwon === undefined) return block;
    converted++;
    before += block.text.length;
    after += lwon.length;
    return { ...block, text: lwon };
  });
  if (converted === 0) return none;
  return { result: { ...result, content }, converted, before, after };
}

function isTextBlock(block: unknown): block is { type: 'text'; text: string } {
  if (typeof block !== 'object' || block === null) return false;
  const b = block as { type?: unknown; text?: unknown };
  return b.type === 'text' && typeof b.text === 'string';
}
