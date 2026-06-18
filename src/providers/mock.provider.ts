import type {
  AIProvider,
  CapabilityMap,
  ChatInput,
  ChatResult,
  PromptInput,
} from "../core/types.js";
import { normalizeCapabilities } from "../core/capabilities.js";
import { chatViaGenerate } from "./shared.js";

export interface MockProviderOptions {
  id?: string;
  capabilities?: Partial<CapabilityMap>;
  priority?: number;
  performance?: number;
  local?: boolean;
  available?: boolean;
  /**
   * Response strategy. Either a fixed string, or a function of the prompt. If
   * it throws (or returns a rejected promise), the provider "fails" so fallback
   * behaviour can be exercised.
   */
  respond?: string | ((prompt: string) => string | Promise<string>);
  /** Force every generate/chat call to reject with this message. */
  fail?: string;
}

/**
 * A configurable in-memory provider for tests and examples. It never touches
 * the network or any real model.
 */
export function mockProvider(options: MockProviderOptions = {}): AIProvider {
  const id = options.id ?? "mock";

  async function generate(input: PromptInput): Promise<string> {
    if (options.fail) throw new Error(options.fail);
    if (typeof options.respond === "function") {
      return options.respond(input.prompt);
    }
    return options.respond ?? "";
  }

  const provider: AIProvider = {
    id,
    capabilities: normalizeCapabilities(
      options.capabilities ?? {
        chat: true,
        serialize: true,
        classify: true,
        extract: true,
        replace: true,
      },
    ),
    priority: options.priority,
    performance: options.performance,
    local: options.local ?? true,
    generate,
    chat: (input: ChatInput): Promise<ChatResult> =>
      chatViaGenerate(id, generate, input),
  };

  if (options.available !== undefined) {
    provider.isAvailable = () => options.available as boolean;
  }

  return provider;
}
