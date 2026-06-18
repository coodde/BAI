import type {
  ChatInput,
  ChatMessage,
  ChatResult,
  PromptInput,
} from "../core/types.js";

/** Flattens a message list into a single prompt for generate-only engines. */
export function messagesToPrompt(messages: ChatMessage[]): {
  system?: string;
  prompt: string;
} {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return {
    system: system || undefined,
    prompt: `${turns}\nAssistant:`,
  };
}

/** Builds a ChatResult, appending the assistant turn to the history. */
export function toChatResult(
  providerId: string,
  messages: ChatMessage[],
  text: string,
): ChatResult {
  return {
    text,
    provider: providerId,
    messages: [...messages, { role: "assistant", content: text }],
  };
}

/**
 * Default `chat` implementation for engines that only expose `generate`.
 * Flattens the conversation, generates, and re-assembles a ChatResult. Honours
 * streaming if the supplied generate function streams via `onToken`.
 */
export async function chatViaGenerate(
  providerId: string,
  generate: (input: PromptInput & { onToken?: (c: string) => void }) => Promise<string>,
  input: ChatInput,
): Promise<ChatResult> {
  const { system, prompt } = messagesToPrompt(input.messages);
  const text = await generate({
    prompt,
    system,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    signal: input.signal,
    onToken: input.stream ? input.onToken : undefined,
  });
  return toChatResult(providerId, input.messages, text);
}
