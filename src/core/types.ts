/**
 * Core type definitions for the BAI runtime.
 *
 * The design goal: a small, capability-driven surface that reads like a DOM
 * API for intelligence tasks. Providers advertise what they can do; the router
 * picks one per capability and falls back when a provider is missing or fails.
 */

/** The set of high-level tasks a provider may support. */
export type Capability =
  | "chat"
  | "serialize"
  | "classify"
  | "extract"
  | "replace";

/** A capability support map. Every provider declares this. */
export interface CapabilityMap {
  chat: boolean;
  serialize: boolean;
  classify: boolean;
  extract: boolean;
  replace: boolean;
}

/** A single turn in a conversation. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options shared by most generation calls. */
export interface GenerateOptions {
  /** Sampling temperature. Lower is more deterministic. */
  temperature?: number;
  /** Hard cap on generated tokens, when the provider supports it. */
  maxTokens?: number;
  /** Abort signal forwarded to the underlying engine when supported. */
  signal?: AbortSignal;
}

export interface ChatInput extends GenerateOptions {
  messages: ChatMessage[];
  /** Request token streaming. Providers that cannot stream ignore this. */
  stream?: boolean;
  /** Invoked with each text chunk when streaming. */
  onToken?: (chunk: string) => void;
}

export interface ChatResult {
  /** The full assistant message text. */
  text: string;
  /** The provider that produced this result. */
  provider: string;
  /** The full message list including the new assistant turn. */
  messages: ChatMessage[];
}

export interface PromptInput extends GenerateOptions {
  prompt: string;
  /** Optional system instruction prepended to the prompt. */
  system?: string;
}

/**
 * A schema describing the desired shape of serialized output.
 *
 * Each field maps to either a primitive type name (`"string"`, `"number"`,
 * `"boolean"`) or an array of literal strings denoting an enum of allowed
 * values. Nested objects are supported by nesting schemas.
 */
export type SchemaField =
  | "string"
  | "number"
  | "boolean"
  | readonly string[]
  | Schema;

export interface Schema {
  [key: string]: SchemaField;
}

export interface SerializeInput<S extends Schema = Schema> extends GenerateOptions {
  text: string;
  schema: S;
}

export interface ClassifyInput extends GenerateOptions {
  text: string;
  labels: string[];
}

export interface ExtractInput extends GenerateOptions {
  text: string;
  fields: string[];
}

export interface ReplaceInput extends GenerateOptions {
  text: string;
  instruction: string;
}

/**
 * The provider contract. `chat` and `generate` are the two primitives every
 * provider must implement. The capability-specific methods are optional — when
 * absent, the runtime synthesises them on top of `generate`.
 */
export interface AIProvider {
  readonly id: string;
  readonly capabilities: CapabilityMap;
  /** Higher wins when priorities are otherwise equal. Defaults to 0. */
  readonly priority?: number;
  /** Relative speed/quality hint used by routing policies (0..1). */
  readonly performance?: number;
  /** Whether the provider runs fully on-device (no network). */
  readonly local?: boolean;
  /**
   * Marks a last-resort provider. Fallback providers are always tried AFTER
   * every non-fallback provider (overriding priority and policy) and are never
   * removed by the `local-only` policy. Use one to handle "no AI available".
   */
  readonly fallback?: boolean;

  /** Returns true if the provider is usable in the current environment. */
  isAvailable?(): Promise<boolean> | boolean;

  chat(input: ChatInput): Promise<ChatResult>;
  generate(input: PromptInput): Promise<string>;

  serialize?<S extends Schema>(input: SerializeInput<S>): Promise<InferSchema<S>>;
  classify?(input: ClassifyInput): Promise<string>;
  extract?(input: ExtractInput): Promise<Record<string, unknown>>;
  replace?(input: ReplaceInput): Promise<string>;
}

/** Maps a {@link Schema} to the concrete object type it produces. */
export type InferSchema<S extends Schema> = {
  -readonly [K in keyof S]: InferField<S[K]>;
};

type InferField<F> = F extends "string"
  ? string
  : F extends "number"
    ? number
    : F extends "boolean"
      ? boolean
      : F extends readonly string[]
        ? F[number]
        : F extends Schema
          ? InferSchema<F>
          : unknown;

/** Routing policy mode. */
export type PolicyMode = "balanced" | "fastest" | "local-only" | "quality";

export interface Policy {
  mode?: PolicyMode;
}

/** Per-capability ordered list of provider ids, most preferred first. */
export type PriorityConfig = Partial<Record<Capability, string[]>>;

export interface AIConfig {
  /**
   * The engines to route across. Omit it to use the browser-native default
   * (`[chromeAI()]`) — zero-download and cross-browser-safe (it degrades to a
   * clean error where unavailable rather than fetching a heavy model).
   */
  providers?: AIProvider[];
  priority?: PriorityConfig;
  policy?: Policy;
  /**
   * Number of milliseconds a provider failure stays cached so the router skips
   * it without retrying. Defaults to 30_000. Set to 0 to disable caching.
   */
  failureTtl?: number;
}

/** Public, serialisable view of provider capabilities. */
export type ProviderCapabilities = Record<string, CapabilityMap>;
