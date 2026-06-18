/**
 * Streaming chat with a WebLLM engine, plus a custom provider fallback.
 *
 * WebLLM and BrowserAI are opt-in: you create the engine and hand it to BAI,
 * so the heavy WebGPU dependency never bloats this library's bundle.
 */
import { AI, webllm, customProvider } from "@coodde/bai";
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const ai = new AI({
  policy: { mode: "local-only" },
  providers: [
    webllm({
      // Lazily created on first use.
      engine: () => CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC"),
    }),
    customProvider({
      id: "echo",
      local: true,
      generate: async ({ prompt }) => `echo: ${prompt}`,
    }),
  ],
});

const result = await ai.chat({
  messages: [
    { role: "system", content: "You are a terse assistant." },
    { role: "user", content: "Summarize what BAI does in one sentence." },
  ],
  stream: true,
  onToken: (chunk) => process.stdout.write(chunk),
});

console.log("\n---\nfull text:", result.text);
console.log("served by:", result.provider);
