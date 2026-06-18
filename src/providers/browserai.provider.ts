import type { AIProvider, PromptInput } from "../core/types.js";
import { normalizeCapabilities } from "../core/capabilities.js";
import { chatViaGenerate } from "./shared.js";

/**
 * Minimal subset of the @browserai/browserai BrowserAI surface. The library
 * loads a model and exposes `generateText`. Return shapes vary by version, so
 * we accept either a string or `{ text }`/`{ response }`.
 */
export interface BrowserAIEngine {
  generateText(
    prompt: string,
    options?: { temperature?: number; max_tokens?: number; system_prompt?: string },
  ): Promise<string | { text?: string; response?: string }>;
}

export interface BrowserAIProviderOptions {
  /**
   * A ready BrowserAI engine (with a model loaded), or a factory that creates
   * and loads one lazily. Required — BAI does not bundle @browserai/browserai.
   */
  engine: BrowserAIEngine | (() => Promise<BrowserAIEngine>);
  priority?: number;
}

/**
 * In-browser inference via the BrowserAI library (WebGPU/WASM). BAI keeps the
 * dependency opt-in: supply an engine instance or factory.
 */
export function browserAI(options: BrowserAIProviderOptions): AIProvider {
  const id = "browserai";
  let cached: BrowserAIEngine | undefined;

  async function getEngine(): Promise<BrowserAIEngine> {
    if (cached) return cached;
    cached =
      typeof options.engine === "function"
        ? await options.engine()
        : options.engine;
    return cached;
  }

  async function generate(input: PromptInput): Promise<string> {
    const engine = await getEngine();
    const result = await engine.generateText(input.prompt, {
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      system_prompt: input.system,
    });
    if (typeof result === "string") return result;
    return result.text ?? result.response ?? "";
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
    performance: 0.65,
    local: true,
    generate,
    chat: (input) => chatViaGenerate(id, generate, input),
  };
}
