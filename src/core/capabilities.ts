import type { AIProvider, Capability, CapabilityMap } from "./types.js";

export const ALL_CAPABILITIES: Capability[] = [
  "chat",
  "serialize",
  "classify",
  "extract",
  "replace",
];

/**
 * A provider can serve a capability either natively (it declares the flag and
 * implements the method) or synthetically (it can `generate`, so the runtime
 * builds the capability on top of free-form generation).
 *
 * `chat` is special: it has no synthetic fallback because it *is* a primitive.
 */
export function providerSupports(
  provider: AIProvider,
  capability: Capability,
): boolean {
  if (provider.capabilities[capability]) return true;
  if (capability === "chat") return false;
  // Any provider that can generate text can synthesise the text-shaped
  // capabilities via prompt engineering + parsing.
  return typeof provider.generate === "function";
}

/** True only when the provider ships a native implementation of the method. */
export function providerSupportsNatively(
  provider: AIProvider,
  capability: Capability,
): boolean {
  if (!provider.capabilities[capability]) return false;
  if (capability === "chat") return typeof provider.chat === "function";
  return typeof provider[capability] === "function";
}

/** Returns a frozen, defaulted capability map. */
export function normalizeCapabilities(
  partial: Partial<CapabilityMap>,
): CapabilityMap {
  return {
    chat: partial.chat ?? false,
    serialize: partial.serialize ?? false,
    classify: partial.classify ?? false,
    extract: partial.extract ?? false,
    replace: partial.replace ?? false,
  };
}
