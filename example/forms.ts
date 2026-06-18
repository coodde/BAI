/**
 * Form automation: classify and extract from a textarea, then route the form.
 */
import { AI, chromeAI, ollama } from "@coodde/bai";

const ai = new AI({
  providers: [chromeAI(), ollama()],
  priority: {
    classify: ["chrome", "ollama"],
  },
});

const textarea = document.querySelector<HTMLTextAreaElement>("#message")!;
const form = document.querySelector<HTMLFormElement>("#support-form")!;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const category = await ai.classify(textarea.value, [
    "bug",
    "question",
    "request",
  ]);

  const fields = await ai.extract(textarea.value, ["email", "orderId"]);

  console.log({ category, ...fields });
  // Route the ticket based on `category`, prefill fields from `fields`, etc.
});
