import type { AIProvider, ChatInput, ChatResult, PromptInput } from "../core/types.js";
import { normalizeCapabilities } from "../core/capabilities.js";
import { toChatResult } from "./shared.js";

/**
 * Minimal subset of the @mlc-ai/web-llm MLCEngine surface we rely on. The
 * engine exposes an OpenAI-compatible chat completions API.
 */
export interface WebLLMEngine {
  chat: {
    completions: {
      create(req: {
        messages: { role: string; content: string }[];
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
      }): Promise<
        | { choices: { message: { content: string | null } }[] }
        | AsyncIterable<{ choices: { delta: { content?: string } }[] }>
      >;
    };
  };
}

export interface WebLLMProviderOptions {
  /**
   * A ready MLCEngine instance, or a factory that lazily creates one (so the
   * heavy WebGPU model load only happens on first use). Required because BAI
   * does not bundle @mlc-ai/web-llm.
   */
  engine: WebLLMEngine | (() => Promise<WebLLMEngine>);
  priority?: number;
}

/**
 * Runs a model fully in-browser via WebGPU using @mlc-ai/web-llm. BAI does not
 * depend on the package directly — pass in an engine you created so bundle size
 * stays opt-in.
 */
export function webllm(options: WebLLMProviderOptions): AIProvider {
  const id = "webllm";
  let cached: WebLLMEngine | undefined;

  async function getEngine(): Promise<WebLLMEngine> {
    if (cached) return cached;
    cached =
      typeof options.engine === "function"
        ? await options.engine()
        : options.engine;
    return cached;
  }

  async function complete(
    messages: { role: string; content: string }[],
    opts: { temperature?: number; maxTokens?: number; stream?: boolean; onToken?: (c: string) => void },
  ): Promise<string> {
    const engine = await getEngine();
    const result = await engine.chat.completions.create({
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: opts.stream,
    });

    if (Symbol.asyncIterator in (result as object)) {
      let full = "";
      for await (const chunk of result as AsyncIterable<{
        choices: { delta: { content?: string } }[];
      }>) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          opts.onToken?.(delta);
        }
      }
      return full;
    }

    const single = result as { choices: { message: { content: string | null } }[] };
    return single.choices[0]?.message?.content ?? "";
  }

  async function generate(input: PromptInput): Promise<string> {
    const messages = input.system
      ? [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ]
      : [{ role: "user", content: input.prompt }];
    return complete(messages, {
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  async function chat(input: ChatInput): Promise<ChatResult> {
    const text = await complete(input.messages, {
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      stream: input.stream,
      onToken: input.stream ? input.onToken : undefined,
    });
    return toChatResult(id, input.messages, text);
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
    performance: 0.7,
    local: true,
    generate,
    chat,
  };
}
