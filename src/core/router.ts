import type {
  AIConfig,
  AIProvider,
  Capability,
  PolicyMode,
} from "./types.js";
import { providerSupports, providerSupportsNatively } from "./capabilities.js";
import { FailureCache } from "../utils/fallback.js";

/**
 * The default fallback chain when no per-capability priority is configured.
 * Local, on-device engines come first; remote/custom engines last.
 */
export const DEFAULT_CHAIN = [
  "chrome",
  "browserai",
  "webllm",
  "ollama",
  "custom",
];

export interface RouteOptions {
  /** Skip providers currently in the failure cooldown window. */
  failureCache?: FailureCache;
  /** When true, only providers with a native implementation are eligible. */
  nativeOnly?: boolean;
}

/**
 * Decides the ordered list of providers to try for a capability.
 *
 * Ordering inputs, in decreasing weight:
 *  1. local-only policy filters out non-local providers entirely
 *  2. explicit per-capability priority list from config
 *  3. policy mode (fastest/quality sort by performance score)
 *  4. provider.priority (higher first)
 *  5. the default fallback chain position
 */
export class Router {
  private readonly priority: AIConfig["priority"];
  private readonly mode: PolicyMode;

  constructor(
    private readonly providers: AIProvider[],
    config: Pick<AIConfig, "priority" | "policy">,
  ) {
    this.priority = config.priority ?? {};
    this.mode = config.policy?.mode ?? "balanced";
  }

  /** Returns providers that can serve `capability`, best candidate first. */
  candidates(capability: Capability, opts: RouteOptions = {}): AIProvider[] {
    const eligible = this.providers.filter((p) => {
      const supported = opts.nativeOnly
        ? providerSupportsNatively(p, capability)
        : providerSupports(p, capability);
      if (!supported) return false;
      if (this.mode === "local-only" && !p.local) return false;
      if (opts.failureCache?.isFailed(p.id, capability)) return false;
      return true;
    });

    return eligible.sort((a, b) =>
      this.compare(a, b, capability),
    );
  }

  private compare(a: AIProvider, b: AIProvider, capability: Capability): number {
    // 1. Explicit per-capability priority list wins outright.
    const order = this.priority?.[capability];
    if (order && order.length) {
      const ai = indexOrInfinity(order, a.id);
      const bi = indexOrInfinity(order, b.id);
      if (ai !== bi) return ai - bi;
    }

    // 2. Policy-driven sorting.
    if (this.mode === "fastest" || this.mode === "quality") {
      const ap = a.performance ?? 0;
      const bp = b.performance ?? 0;
      if (ap !== bp) return bp - ap; // higher performance first
    }

    if (this.mode === "balanced" || this.mode === "local-only") {
      // Prefer local engines in local-leaning modes.
      const al = a.local ? 0 : 1;
      const bl = b.local ? 0 : 1;
      if (al !== bl) return al - bl;
    }

    // 3. Explicit provider priority (higher first).
    const apr = a.priority ?? 0;
    const bpr = b.priority ?? 0;
    if (apr !== bpr) return bpr - apr;

    // 4. Default chain position.
    return chainIndex(a.id) - chainIndex(b.id);
  }
}

function indexOrInfinity(list: string[], id: string): number {
  const i = list.indexOf(id);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

function chainIndex(id: string): number {
  const i = DEFAULT_CHAIN.indexOf(id);
  return i === -1 ? DEFAULT_CHAIN.length : i;
}
