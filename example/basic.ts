/**
 * Basic usage: structured extraction from free text.
 *
 * Run conceptually in a browser where Chrome built-in AI is available, with a
 * local Ollama server as the fallback. The runtime picks whichever can serve
 * the request — you never address a provider directly.
 */
import { AI, chromeAI, ollama } from "@coodde/bai";

const ai = new AI({
  providers: [chromeAI(), ollama({ model: "llama3.2" })],
});

const result = await ai.serialize(
  "John from ORD-123 says the system is broken and he needs help today",
  {
    name: "string",
    orderId: "string",
    urgency: ["low", "medium", "high"] as const,
  },
);

console.log(result);
// → { name: "John", orderId: "ORD-123", urgency: "high" }
