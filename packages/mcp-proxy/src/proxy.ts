import { PRIMER } from '@lwon/core';
import {
  isJSONRPCErrorResponse,
  isJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type Transport,
} from '@modelcontextprotocol/server';
import { convertToolResult, toolSelected, type ConvertOptions } from './convert.ts';

export interface ProxyOptions extends ConvertOptions {
  /**
   * Where the model learns to read LWON: appended to the server's instructions
   * (the default), or put before the first converted result of the session, for
   * clients that do not show server instructions to the model.
   */
  primer?: 'instructions' | 'first-result';
  /** Forward everything unchanged; with `log`, still report what would have been converted. */
  passthrough?: boolean;
  /** Receives one line per converted result. */
  log?: (line: string) => void;
}

/** Appended to the wrapped server's instructions. */
export const INSTRUCTIONS = `Large JSON tool results from this server are sent in LWON to save tokens.\n\n${PRIMER}`;

type RequestId = string | number;
type Pending = { kind: 'tool'; name: string } | { kind: 'hello' };

/**
 * Relays MCP messages between a client and a server. Every message passes
 * through as it is, except the answers to `tools/call` (and to `tasks/result`
 * for tool calls run as tasks), whose large JSON text becomes LWON, and the
 * answer to `initialize` or `server/discover`, whose instructions gain the
 * LWON primer.
 *
 * `client` faces the MCP client (the proxy's stdin and stdout); `server` is the
 * connection to the wrapped server. Both must not be started yet.
 */
export async function connectProxy(client: Transport, server: Transport, options: ProxyOptions = {}): Promise<void> {
  const primer = options.primer ?? 'instructions';
  /** Requests from the client whose answers the proxy may change, by id. */
  const pending = new Map<RequestId, Pending>();
  /** Tool names of calls the server runs as tasks, by task id. */
  const tasks = new Map<string, string>();
  let primerSent = false;

  const report = (error: unknown) => client.onerror?.(error instanceof Error ? error : new Error(String(error)));
  const forward = (to: Transport, message: JSONRPCMessage) => to.send(message).catch(report);

  const track = (request: JSONRPCRequest) => {
    const params = (request.params ?? {}) as { name?: unknown; taskId?: unknown };
    if (request.method === 'tools/call' && typeof params.name === 'string') {
      pending.set(request.id, { kind: 'tool', name: params.name });
    } else if (request.method === 'tasks/result' && typeof params.taskId === 'string' && tasks.has(params.taskId)) {
      pending.set(request.id, { kind: 'tool', name: tasks.get(params.taskId)! });
    } else if (request.method === 'initialize' || request.method === 'server/discover') {
      pending.set(request.id, { kind: 'hello' });
    }
  };

  const rewrite = (call: Pending, result: Record<string, unknown>): Record<string, unknown> => {
    if (call.kind === 'hello') {
      if (options.passthrough || primer !== 'instructions') return result;
      const own = typeof result.instructions === 'string' && result.instructions.trim() ? result.instructions : '';
      return { ...result, instructions: own ? `${own}\n\n${INSTRUCTIONS}` : INSTRUCTIONS };
    }

    const task = (result.task ?? {}) as { taskId?: unknown };
    if (typeof task.taskId === 'string') tasks.set(task.taskId, call.name);

    if ((options.passthrough && !options.log) || !toolSelected(call.name, options)) return result;
    const out = convertToolResult(result, options);
    if (out.converted === 0) return result;
    const saved = Math.round((1 - out.after / out.before) * 100);
    options.log?.(
      `${call.name}: ${out.before} -> ${out.after} chars (-${saved}%)${options.passthrough ? ', not sent (passthrough)' : ''}`,
    );
    if (options.passthrough) return result;
    if (primer === 'first-result' && !primerSent) {
      primerSent = true;
      return withPrimer(result.content as unknown[], out.result);
    }
    return out.result;
  };

  client.onmessage = (message: JSONRPCMessage) => {
    if (isJSONRPCRequest(message)) track(message);
    else if (isJSONRPCNotification(message) && message.method === 'notifications/cancelled') {
      const id = (message.params as { requestId?: RequestId } | undefined)?.requestId;
      if (id !== undefined) pending.delete(id);
    }
    void forward(server, message);
  };

  server.onmessage = (message: JSONRPCMessage) => {
    if (isJSONRPCResultResponse(message) && pending.has(message.id)) {
      const call = pending.get(message.id)!;
      pending.delete(message.id);
      try {
        const result = rewrite(call, message.result as Record<string, unknown>);
        if (result !== message.result) message = { ...message, result } as JSONRPCMessage;
      } catch (error) {
        report(error);
      }
    } else if (isJSONRPCErrorResponse(message) && message.id !== undefined) {
      pending.delete(message.id);
    }
    void forward(client, message);
  };

  // Whichever side closes first takes the other one down with it.
  client.onclose = () => void server.close();
  server.onclose = () => void client.close();

  await server.start();
  await client.start();
}

/** Puts the primer before the first block that was converted. */
function withPrimer(original: unknown[], result: Record<string, unknown>): Record<string, unknown> {
  const content = [...(result.content as { text?: string }[])];
  const i = content.findIndex((block, j) => block !== original[j]);
  content[i] = { ...content[i], text: `${PRIMER}\n\n${content[i]!.text}` };
  return { ...result, content };
}
