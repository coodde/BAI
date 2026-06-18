import type {
  AIConfig,
  AIProvider,
  Capability,
  ChatInput,
  ChatResult,
  GenerateOptions,
  InferSchema,
  ProviderCapabilities,
  Schema,
} from "./types.js";
import { Router } from "./router.js";
import { FailureCache, NoProviderError, type ProviderAttempt } from "../utils/fallback.js";
import { runChat } from "../methods/chat.js";
import { runMessage } from "../methods/message.js";
import { runSerialize } from "../methods/serialize.js";
import { runClassify } from "../methods/classify.js";
import { runExtract } from "../methods/extract.js";
import { runReplace } from "../methods/replace.js";

const DEFAULT_FAILURE_TTL = 30_000;

/**
 * The BAI runtime. Construct it with a list of providers and optional routing
 * preferences, then call capability methods. Routing, fallback, and synthetic
 * capability synthesis are handled internally — callers never pick a provider.
 */
export class AI {
  private readonly providers: AIProvider[];
  private readonly router: Router;
  private readonly failureCache: FailureCache;

  constructor(config: AIConfig) {
    if (!config.providers || config.providers.length === 0) {
      throw new Error("AI requires at least one provider");
    }
    this.assertUniqueIds(config.providers);
    this.providers = config.providers;
    this.router = new Router(this.providers, {
      priority: config.priority,
      policy: config.policy,
    });
    this.failureCache = new FailureCache(
      config.failureTtl ?? DEFAULT_FAILURE_TTL,
    );
  }

  /** Multi-turn conversation with streaming and fallback support. */
  chat(input: ChatInput): Promise<ChatResult> {
    return this.run("chat", (p) => runChat(p, input));
  }

  /** Single-prompt shortcut. */
  message(prompt: string, options: GenerateOptions & { system?: string } = {}): Promise<string> {
    return this.run("chat", (p) =>
      runMessage(p, { prompt, ...options }),
    );
  }

  /** Convert unstructured text into a structured object matching `schema`. */
  serialize<S extends Schema>(
    text: string,
    schema: S,
    options: GenerateOptions = {},
  ): Promise<InferSchema<S>> {
    return this.run("serialize", (p) =>
      runSerialize(p, { text, schema, ...options }),
    );
  }

  /** Classify `text` into exactly one of `labels`. */
  classify(
    text: string,
    labels: string[],
    options: GenerateOptions = {},
  ): Promise<string> {
    return this.run("classify", (p) =>
      runClassify(p, { text, labels, ...options }),
    );
  }

  /** Extract a partial set of `fields` from `text`. */
  extract(
    text: string,
    fields: string[],
    options: GenerateOptions = {},
  ): Promise<Record<string, unknown>> {
    return this.run("extract", (p) =>
      runExtract(p, { text, fields, ...options }),
    );
  }

  /** Rewrite `text` according to a natural-language `instruction`. */
  replace(
    text: string,
    instruction: string,
    options: GenerateOptions = {},
  ): Promise<string> {
    return this.run("replace", (p) =>
      runReplace(p, { text, instruction, ...options }),
    );
  }

  /** Snapshot of every registered provider's declared capabilities. */
  capabilities(): ProviderCapabilities {
    const out: ProviderCapabilities = {};
    for (const p of this.providers) out[p.id] = { ...p.capabilities };
    return out;
  }

  /** The ordered provider ids that would be tried for a capability right now. */
  route(capability: Capability): string[] {
    return this.router
      .candidates(capability, { failureCache: this.failureCache })
      .map((p) => p.id);
  }

  /** Clears the failure cooldown cache, re-enabling skipped providers. */
  resetFailures(): void {
    this.failureCache.clear();
  }

  /**
   * Core fallback loop: walk the routed candidates, attempt each, and on
   * failure record a cooldown and move to the next. Throws NoProviderError if
   * every candidate is exhausted.
   */
  private async run<T>(
    capability: Capability,
    exec: (provider: AIProvider) => Promise<T>,
  ): Promise<T> {
    const candidates = this.router.candidates(capability, {
      failureCache: this.failureCache,
    });
    const attempts: ProviderAttempt[] = [];

    for (const provider of candidates) {
      if (provider.isAvailable) {
        try {
          const ok = await provider.isAvailable();
          if (!ok) {
            this.failureCache.record(provider.id, capability);
            attempts.push({ providerId: provider.id, reason: "unavailable" });
            continue;
          }
        } catch (err) {
          this.failureCache.record(provider.id, capability);
          attempts.push({
            providerId: provider.id,
            reason: `availability check threw: ${errText(err)}`,
          });
          continue;
        }
      }

      try {
        return await exec(provider);
      } catch (err) {
        this.failureCache.record(provider.id, capability);
        attempts.push({ providerId: provider.id, reason: errText(err) });
      }
    }

    throw new NoProviderError(capability, attempts);
  }

  private assertUniqueIds(providers: AIProvider[]): void {
    const seen = new Set<string>();
    for (const p of providers) {
      if (seen.has(p.id)) {
        throw new Error(`Duplicate provider id: "${p.id}"`);
      }
      seen.add(p.id);
    }
  }
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
