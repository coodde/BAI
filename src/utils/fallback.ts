/**
 * Tracks recent provider failures so the router can skip a provider that just
 * failed instead of retrying it on every call. Entries expire after `ttl` ms.
 */
export class FailureCache {
  private readonly failures = new Map<string, number>();

  constructor(private readonly ttl: number) {}

  /** Record that `providerId` failed for `capability` just now. */
  record(providerId: string, capability: string): void {
    if (this.ttl <= 0) return;
    this.failures.set(this.key(providerId, capability), Date.now());
  }

  /** True if this provider/capability pair is within the cooldown window. */
  isFailed(providerId: string, capability: string): boolean {
    if (this.ttl <= 0) return false;
    const at = this.failures.get(this.key(providerId, capability));
    if (at === undefined) return false;
    if (Date.now() - at > this.ttl) {
      this.failures.delete(this.key(providerId, capability));
      return false;
    }
    return true;
  }

  clear(): void {
    this.failures.clear();
  }

  private key(providerId: string, capability: string): string {
    return `${providerId}::${capability}`;
  }
}

/** Error thrown when no provider can satisfy a capability. */
export class NoProviderError extends Error {
  constructor(
    public readonly capability: string,
    public readonly attempts: ProviderAttempt[],
  ) {
    const detail = attempts.length
      ? attempts
          .map((a) => `${a.providerId}: ${a.reason}`)
          .join("; ")
      : "no providers advertised this capability";
    super(`No provider could handle "${capability}" (${detail})`);
    this.name = "NoProviderError";
  }
}

export interface ProviderAttempt {
  providerId: string;
  reason: string;
}
