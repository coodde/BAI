import type { AIProvider, InferSchema, Schema, SerializeInput } from "../core/types.js";
import { providerSupportsNatively } from "../core/capabilities.js";
import { buildSerializePrompt } from "../utils/promptBuilder.js";
import { coerceToSchema, extractJson } from "../utils/jsonValidator.js";

/** Run `serialize` on a provider, using its native method or synthesising one. */
export async function runSerialize<S extends Schema>(
  provider: AIProvider,
  input: SerializeInput<S>,
): Promise<InferSchema<S>> {
  if (providerSupportsNatively(provider, "serialize") && provider.serialize) {
    return provider.serialize(input);
  }

  const raw = await provider.generate({
    prompt: buildSerializePrompt(input.text, input.schema),
    temperature: input.temperature ?? 0,
    maxTokens: input.maxTokens,
    signal: input.signal,
  });

  return coerceToSchema(extractJson(raw), input.schema);
}
