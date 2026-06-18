import type { AIProvider, ClassifyInput } from "../core/types.js";
import { providerSupportsNatively } from "../core/capabilities.js";
import { buildClassifyPrompt } from "../utils/promptBuilder.js";
import { matchLabel } from "../utils/jsonValidator.js";

/** Run `classify`, returning one of `labels`. */
export async function runClassify(
  provider: AIProvider,
  input: ClassifyInput,
): Promise<string> {
  if (input.labels.length === 0) {
    throw new Error("classify requires at least one label");
  }

  if (providerSupportsNatively(provider, "classify") && provider.classify) {
    return provider.classify(input);
  }

  const raw = await provider.generate({
    prompt: buildClassifyPrompt(input.text, input.labels),
    temperature: input.temperature ?? 0,
    maxTokens: input.maxTokens,
    signal: input.signal,
  });

  return matchLabel(raw, input.labels);
}
