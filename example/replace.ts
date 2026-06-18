/**
 * Inline text transformation: rewrite an input's value on demand.
 */
import { AI, chromeAI, ollama } from "@coodde/bai";

const ai = new AI({ providers: [chromeAI(), ollama()] });

const input = document.querySelector<HTMLTextAreaElement>("#draft")!;
const button = document.querySelector<HTMLButtonElement>("#polish")!;

button.addEventListener("click", async () => {
  input.value = await ai.replace(input.value, "make it formal and concise");
});

// One-off usage:
const polished = await ai.replace(
  "I has problem with order",
  "fix grammar and make professional",
);
console.log(polished);
// → "I have a problem with my order."
