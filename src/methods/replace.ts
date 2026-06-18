import type { AIProvider, ReplaceInput } from "../core/types.js";
import { providerSupportsNatively } from "../core/capabilities.js";
import { buildReplacePrompt } from "../utils/promptBuilder.js";

/** Run `replace`, returning the rewritten text. */
export async function runReplace(
  provider: AIProvider,
  input: ReplaceInput,
): Promise<string> {
  if (providerSupportsNatively(provider, "replace") && provider.replace) {
    return provider.replace(input);
  }

  const raw = await provider.generate({
    prompt: buildReplacePrompt(input.text, input.instruction),
    temperature: input.temperature ?? 0.3,
    maxTokens: input.maxTokens,
    signal: input.signal,
  });

  return cleanup(raw);
}

/** Strip stray fences/surrounding quotes models sometimes add. */
function cleanup(text: string): string {
  let out = text.trim();
  const fence = /```(?:\w+)?\s*([\s\S]*?)```/.exec(out);
  if (fence) out = fence[1].trim();
  if (out.length >= 2 && /^["'].*["']$/s.test(out)) {
    out = out.slice(1, -1).trim();
  }
  return out;
}
