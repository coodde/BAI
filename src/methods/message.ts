import type { AIProvider, PromptInput } from "../core/types.js";

/** Single-prompt shortcut built on a provider's `generate` primitive. */
export async function runMessage(
  provider: AIProvider,
  input: PromptInput,
): Promise<string> {
  return provider.generate(input);
}
