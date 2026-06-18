import type {
  AIProvider,
  CapabilityMap,
  ChatInput,
  ChatResult,
  PromptInput,
} from "../core/types.js";
import { normalizeCapabilities } from "../core/capabilities.js";
import { chatViaGenerate } from "./shared.js";

export interface CustomProviderOptions {
  id?: string;
  /** The only required hook: turn a prompt into text. */
  generate: (input: PromptInput) => Promise<string>;
  /** Optional native chat; defaults to flattening via `generate`. */
  chat?: (input: ChatInput) => Promise<ChatResult>;
  capabilities?: Partial<CapabilityMap>;
  priority?: number;
  performance?: number;
  local?: boolean;
  isAvailable?: () => boolean | Promise<boolean>;
}

/**
 * Wraps any user-supplied generation function as a BAI provider. This is the
 * escape hatch for engines BAI does not ship a built-in adapter for (a remote
 * proxy, a custom WebGPU model, a test double, etc.).
 */
export function customProvider(options: CustomProviderOptions): AIProvider {
  const id = options.id ?? "custom";
  const capabilities = normalizeCapabilities(
    options.capabilities ?? {
      chat: true,
      serialize: true,
      classify: true,
      extract: true,
      replace: true,
    },
  );

  return {
    id,
    capabilities,
    priority: options.priority,
    performance: options.performance,
    local: options.local,
    isAvailable: options.isAvailable,
    generate: options.generate,
    chat:
      options.chat ??
      ((input) => chatViaGenerate(id, options.generate, input)),
  };
}
