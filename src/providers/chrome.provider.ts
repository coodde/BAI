import type { AIProvider, ChatInput, ChatResult, PromptInput } from "../core/types.js";
import { normalizeCapabilities } from "../core/capabilities.js";
import { chatViaGenerate, messagesToPrompt, toChatResult } from "./shared.js";

/**
 * Minimal shape of Chrome's built-in Prompt API. Both the newer global
 * `LanguageModel` and the older `window.ai.languageModel` namespace expose
 * roughly this surface.
 */
interface LanguageModelSession {
  prompt(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming?(input: string, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
  destroy?(): void;
}

interface LanguageModelFactory {
  availability?(): Promise<string>;
  capabilities?(): Promise<{ available: string }>;
  create(opts?: {
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
  }): Promise<LanguageModelSession>;
}

function getFactory(): LanguageModelFactory | undefined {
  const g = globalThis as unknown as {
    LanguageModel?: LanguageModelFactory;
    ai?: { languageModel?: LanguageModelFactory };
  };
  return g.LanguageModel ?? g.ai?.languageModel;
}

async function isReady(factory: LanguageModelFactory): Promise<boolean> {
  try {
    if (factory.availability) {
      const a = await factory.availability();
      return a === "available" || a === "readily" || a === "downloadable";
    }
    if (factory.capabilities) {
      const c = await factory.capabilities();
      return c.available === "readily" || c.available === "after-download";
    }
  } catch {
    return false;
  }
  return true;
}

export interface ChromeProviderOptions {
  priority?: number;
  /** Override factory injection — useful for tests. */
  factory?: LanguageModelFactory;
}

/**
 * Chrome built-in AI (Gemini Nano) via the on-device Prompt API. Fully local
 * and the preferred engine when present, but only available in supporting
 * Chrome builds — `isAvailable` gates it so the router can fall back cleanly.
 */
export function chromeAI(options: ChromeProviderOptions = {}): AIProvider {
  const id = "chrome";
  const resolveFactory = () => options.factory ?? getFactory();

  async function generate(input: PromptInput): Promise<string> {
    const factory = resolveFactory();
    if (!factory) throw new Error("Chrome built-in AI is not available");

    const session = await factory.create({
      systemPrompt: input.system,
      temperature: input.temperature,
    });
    try {
      return await session.prompt(input.prompt, { signal: input.signal });
    } finally {
      session.destroy?.();
    }
  }

  async function chat(input: ChatInput): Promise<ChatResult> {
    const factory = resolveFactory();
    if (!factory) throw new Error("Chrome built-in AI is not available");

    const { system, prompt } = messagesToPrompt(input.messages);
    const session = await factory.create({
      systemPrompt: system,
      temperature: input.temperature,
    });

    try {
      if (input.stream && input.onToken && session.promptStreaming) {
        let full = "";
        for await (const chunk of session.promptStreaming(prompt, {
          signal: input.signal,
        })) {
          // Some builds yield cumulative text; emit only the delta.
          const delta = chunk.startsWith(full) ? chunk.slice(full.length) : chunk;
          full = chunk.startsWith(full) ? chunk : full + chunk;
          if (delta) input.onToken(delta);
        }
        return toChatResult(id, input.messages, full);
      }

      const text = await session.prompt(prompt, { signal: input.signal });
      return toChatResult(id, input.messages, text);
    } finally {
      session.destroy?.();
    }
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
    performance: 0.6,
    local: true,
    isAvailable: async () => {
      const factory = resolveFactory();
      if (!factory) return false;
      return isReady(factory);
    },
    generate,
    chat: (input) =>
      // Use the streaming-aware chat above; chatViaGenerate is the non-stream path.
      input.stream ? chat(input) : chatViaGenerate(id, generate, input),
  };
}
