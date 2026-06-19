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
  /** Marks this as a last-resort provider (always tried last, never filtered). */
  fallback?: boolean;
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
    fallback: options.fallback,
    isAvailable: options.isAvailable,
    generate: options.generate,
    chat:
      options.chat ??
      ((input) => chatViaGenerate(id, options.generate, input)),
  };
}

/**
 * A last-resort provider. BAI tries it only AFTER every other provider, no
 * matter the `priority` list or `policy` (it even survives `local-only`). Use
 * it to handle the "no on-device AI available" case — call your backend or a
 * hosted LLM, return a hardcoded result, or surface a friendly error.
 *
 * @example
 * ```ts
 * const ai = new AI({
 *   providers: [
 *     chromeAI(),
 *     fallbackProvider({
 *       generate: async ({ prompt }) => {
 *         const res = await fetch("/api/ai", {
 *           method: "POST",
 *           body: JSON.stringify({ prompt }),
 *         });
 *         return (await res.json()).text;
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function fallbackProvider(
  options: Omit<CustomProviderOptions, "fallback">,
): AIProvider {
  return customProvider({
    ...options,
    id: options.id ?? "fallback",
    local: options.local ?? false,
    fallback: true,
  });
}
