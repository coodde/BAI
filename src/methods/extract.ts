import type { AIProvider, ExtractInput } from "../core/types.js";
import { providerSupportsNatively } from "../core/capabilities.js";
import { buildExtractPrompt } from "../utils/promptBuilder.js";
import { extractJson } from "../utils/jsonValidator.js";

/** Run `extract`, returning a partial record of the requested fields. */
export async function runExtract(
  provider: AIProvider,
  input: ExtractInput,
): Promise<Record<string, unknown>> {
  if (providerSupportsNatively(provider, "extract") && provider.extract) {
    return provider.extract(input);
  }

  const raw = await provider.generate({
    prompt: buildExtractPrompt(input.text, input.fields),
    temperature: input.temperature ?? 0,
    maxTokens: input.maxTokens,
    signal: input.signal,
  });

  const parsed = extractJson(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  // Keep only the requested fields with non-empty values.
  const source = parsed as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of input.fields) {
    const value = source[field];
    if (value !== undefined && value !== null && value !== "") {
      out[field] = value;
    }
  }
  return out;
}
