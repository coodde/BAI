import type { AIProvider, ChatInput, ChatResult, PromptInput } from "../core/types.js";
import { normalizeCapabilities } from "../core/capabilities.js";
import { toChatResult } from "./shared.js";

export interface OllamaProviderOptions {
  /** Base URL of the Ollama server. Defaults to http://localhost:11434. */
  host?: string;
  /** Model tag to use, e.g. "llama3.2". Defaults to "llama3.2". */
  model?: string;
  priority?: number;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
}

interface OllamaChatResponse {
  message?: { content?: string };
  response?: string;
}

/**
 * Talks to a locally running Ollama server over HTTP. Considered "local" for
 * routing because it runs on the same machine, though it is technically a
 * network call to localhost.
 */
export function ollama(options: OllamaProviderOptions = {}): AIProvider {
  const id = "ollama";
  const host = (options.host ?? "http://localhost:11434").replace(/\/$/, "");
  const model = options.model ?? "llama3.2";
  const doFetch = options.fetch ?? globalThis.fetch;

  async function post(path: string, body: unknown, signal?: AbortSignal): Promise<OllamaChatResponse> {
    if (!doFetch) throw new Error("No fetch implementation available for Ollama");
    const res = await doFetch(`${host}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as OllamaChatResponse;
  }

  async function generate(input: PromptInput): Promise<string> {
    const data = await post(
      "/api/generate",
      {
        model,
        prompt: input.prompt,
        system: input.system,
        stream: false,
        options: optionsFor(input),
      },
      input.signal,
    );
    return data.response ?? "";
  }

  async function chat(input: ChatInput): Promise<ChatResult> {
    const data = await post(
      "/api/chat",
      {
        model,
        messages: input.messages,
        stream: false,
        options: optionsFor(input),
      },
      input.signal,
    );
    return toChatResult(id, input.messages, data.message?.content ?? "");
  }

  return {
    id,
    capabilities: normalizeCapabilities({
      chat: true,
      serialize: true,
      classify: true,
      extract: true,
      replace: true,
    }),
    priority: options.priority,
    performance: 0.8,
    local: true,
    isAvailable: async () => {
      if (!doFetch) return false;
      try {
        const res = await doFetch(`${host}/api/tags`);
        return res.ok;
      } catch {
        return false;
      }
    },
    generate,
    chat,
  };
}

function optionsFor(input: { temperature?: number; maxTokens?: number }) {
  const opts: Record<string, number> = {};
  if (input.temperature !== undefined) opts.temperature = input.temperature;
  if (input.maxTokens !== undefined) opts.num_predict = input.maxTokens;
  return opts;
}
