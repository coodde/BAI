/**
 * Last-resort fallback: prefer on-device AI, but always have a safety net.
 *
 * The fallback provider is tried only after every other provider fails or is
 * unavailable — overriding priority/policy. Use it to call your backend (which
 * might host its own model or proxy a hosted LLM), or to degrade gracefully.
 */
import { AI, chromeAI, fallbackProvider } from "@coodde/bai";

const ai = new AI({
  providers: [
    chromeAI(), // on-device, zero download — used whenever available
    fallbackProvider({
      id: "backend",
      generate: async ({ prompt, system }) => {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, system }),
        });
        if (!res.ok) throw new Error(`backend ${res.status}`);
        return (await res.json()).text as string;
      },
    }),
  ],
});

// Runs entirely on-device in Chrome; transparently hits /api/ai elsewhere.
const result = await ai.serialize("John from ORD-123 needs help now", {
  name: "string",
  orderId: "string",
  urgency: ["low", "medium", "high"] as const,
});

console.log(result);

// A purely defensive fallback that never touches the network:
const offlineSafe = new AI({
  providers: [
    chromeAI(),
    fallbackProvider({
      id: "static",
      generate: async () => {
        throw new Error("AI is unavailable — please try again later.");
      },
    }),
  ],
});

void offlineSafe;
