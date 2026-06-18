import type { AIProvider, ChatInput, ChatResult } from "../core/types.js";

/** Run a multi-turn chat against a provider. */
export async function runChat(
  provider: AIProvider,
  input: ChatInput,
): Promise<ChatResult> {
  if (input.messages.length === 0) {
    throw new Error("chat requires at least one message");
  }
  return provider.chat(input);
}
