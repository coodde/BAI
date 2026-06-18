/**
 * @coodde/bai — Browser AI SDK.
 *
 * A unified, capability-driven AI runtime for the frontend. Call high-level
 * intelligence tasks (`serialize`, `classify`, `extract`, `replace`, `chat`)
 * and let the runtime route to whatever engine is available, with automatic
 * fallback. Behaves like a DOM API for intelligence — not an LLM framework.
 */

// Core
export { AI } from "./core/AI.js";
export { Router, DEFAULT_CHAIN } from "./core/router.js";
export {
  providerSupports,
  providerSupportsNatively,
  normalizeCapabilities,
  ALL_CAPABILITIES,
} from "./core/capabilities.js";

// Errors / fallback internals worth surfacing
export { NoProviderError, FailureCache } from "./utils/fallback.js";
export { JsonParseError } from "./utils/jsonValidator.js";

// Providers
export { chromeAI } from "./providers/chrome.provider.js";
export { browserAI } from "./providers/browserai.provider.js";
export { ollama } from "./providers/ollama.provider.js";
export { webllm } from "./providers/webllm.provider.js";
export { customProvider } from "./providers/custom.provider.js";
export { mockProvider } from "./providers/mock.provider.js";

// Types
export type {
  AIConfig,
  AIProvider,
  Capability,
  CapabilityMap,
  ChatInput,
  ChatMessage,
  ChatResult,
  ClassifyInput,
  ExtractInput,
  GenerateOptions,
  InferSchema,
  Policy,
  PolicyMode,
  PriorityConfig,
  PromptInput,
  ProviderCapabilities,
  ReplaceInput,
  Schema,
  SchemaField,
  SerializeInput,
} from "./core/types.js";

export type { ChromeProviderOptions } from "./providers/chrome.provider.js";
export type { BrowserAIProviderOptions, BrowserAIEngine } from "./providers/browserai.provider.js";
export type { OllamaProviderOptions } from "./providers/ollama.provider.js";
export type { WebLLMProviderOptions, WebLLMEngine } from "./providers/webllm.provider.js";
export type { CustomProviderOptions } from "./providers/custom.provider.js";
export type { MockProviderOptions } from "./providers/mock.provider.js";
