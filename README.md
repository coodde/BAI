# @coodde/bai — Browser AI SDK

> AI runtime for the frontend that behaves like a DOM API for intelligence tasks — not like an LLM framework.

BAI gives you a small, unified API for common UI AI tasks (`serialize`, `classify`, `extract`, `replace`, `chat`) and decides *which engine runs them* for you. Point it at one or more providers (Chrome built-in AI, WebLLM, BrowserAI, Ollama, or your own), declare optional preferences, and call methods. Routing and fallback are handled internally.

```ts
// ❌ provider-centric                     // ✅ capability-centric
openai.chat()                              ai.chat()
ollama.chat()                              ai.serialize()
                                           ai.classify()
                                           ai.replace()
```

## Why

- **UI-first.** Built for form automation, text cleanup, and inline enhancement — not agent graphs.
- **Capability-driven routing.** You ask for a *task*; BAI selects an engine that can do it and falls back when one is missing or fails.
- **Browser-native & local-first.** Prefers on-device engines (Chrome AI, WebLLM, BrowserAI) before reaching out to a local Ollama or a custom backend.
- **Zero backend dependency. No API keys in the browser.** Bring your own engine if you need one.
- **Tiny surface.** No toolchains, no orchestration trees, no LangChain-style abstractions.

## Install

```bash
npm install @coodde/bai
```

WebLLM and BrowserAI are **opt-in peer engines** — install them only if you use those providers:

```bash
npm install @mlc-ai/web-llm        # for webllm()
npm install @browserai/browserai   # for browserAI()
```

## Quick start

```ts
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
// { name: "John", orderId: "ORD-123", urgency: "high" }  — typed!
```

The schema drives both the prompt and the **return type**: enums narrow to a union, `"number"`/`"boolean"` coerce, nested objects are supported.

## API

### `new AI(config)`

`providers` is **optional**. Omit it and BAI uses the browser-native default — `[chromeAI()]` — which downloads nothing page-side and degrades to a clean `NoProviderError` on browsers without built-in AI (rather than fetching a heavy model). Add heavier engines explicitly when you want fallback.

```ts
const ai = new AI();                  // browser-native default ([chromeAI()])
const ai = new AI({ providers: [...] }); // explicit engines

const ai = new AI({
  providers: [chromeAI(), browserAI({ engine }), ollama()],

  // Optional: ordered preference per capability (provider ids).
  priority: {
    chat: ["ollama", "chrome", "browserai"],
    serialize: ["chrome", "browserai", "ollama"],
    classify: ["chrome", "browserai"],
  },

  // Optional: routing policy.
  policy: { mode: "balanced" }, // "balanced" | "fastest" | "local-only" | "quality"

  // Optional: ms a failed provider stays on cooldown (default 30000, 0 disables).
  failureTtl: 30_000,
});
```

### Methods

| Method | Signature | Returns |
| --- | --- | --- |
| `chat` | `ai.chat({ messages, stream?, onToken? })` | `ChatResult` |
| `message` | `ai.message(prompt, options?)` | `string` |
| `serialize` | `ai.serialize(text, schema, options?)` | typed object |
| `classify` | `ai.classify(text, labels, options?)` | one of `labels` |
| `extract` | `ai.extract(text, fields, options?)` | partial `Record` |
| `replace` | `ai.replace(text, instruction, options?)` | `string` |
| `capabilities` | `ai.capabilities()` | per-provider capability map |
| `route` | `ai.route(capability)` | ordered provider ids that would be tried |
| `resetFailures` | `ai.resetFailures()` | clears the failure cooldown cache |

```ts
// chat (multi-turn, optional streaming)
const { text } = await ai.chat({
  messages: [
    { role: "system", content: "You are terse." },
    { role: "user", content: "Summarize this thread." },
  ],
  stream: true,
  onToken: (chunk) => process.stdout.write(chunk),
});

// message — single-prompt shortcut
await ai.message("Summarize this text");

// classify — best label
await ai.classify(textarea.value, ["bug", "feature", "question"]);

// extract — lightweight, partial fields
await ai.extract("Email a@b.com about ORD-9", ["email", "orderId"]);
// { email: "a@b.com", orderId: "ORD-9" }

// replace — text transformation
await ai.replace("I has problem with order", "fix grammar and make professional");
// "I have a problem with my order."
```

## Routing & fallback

For each call, BAI builds an ordered candidate list for the requested capability and tries them in turn:

1. **`local-only` policy** removes non-local providers entirely.
2. **Explicit `priority[capability]`** ordering wins.
3. **Policy mode** — `fastest`/`quality` sort by each provider's performance hint.
4. **`balanced`/`local-only`** prefer local engines.
5. **`provider.priority`** (higher first), then the default chain position:

```
chrome → browserai → webllm → ollama → custom
```

A provider is eligible for a capability if it supports it **natively** *or* can **synthesize** it from `generate` (BAI builds the prompt and parses/validates the output). Only `chat` requires native support.

When a provider is unavailable, missing the capability, or throws, BAI records a short **failure cooldown** and moves to the next candidate. If all are exhausted it throws `NoProviderError` listing every attempt.

```ts
ai.route("serialize"); // ["chrome", "ollama"] — inspect the resolved order
```

## Providers

| Factory | Engine | Notes |
| --- | --- | --- |
| `chromeAI()` | Chrome built-in AI (Gemini Nano, Prompt API) | On-device; gated by `isAvailable`. |
| `browserAI({ engine })` | [BrowserAI](https://github.com/sauravpanda/BrowserAI) | WebGPU/WASM; pass an engine or factory. |
| `webllm({ engine })` | [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) | WebGPU; pass an `MLCEngine` or factory. |
| `ollama({ host?, model? })` | Local [Ollama](https://ollama.com) server | HTTP to `localhost:11434`. |
| `customProvider({ generate, ... })` | Anything | Escape hatch — wrap any text generator. |
| `mockProvider({ respond, ... })` | In-memory | For tests and demos. |

### Custom provider

```ts
import { AI, customProvider } from "@coodde/bai";

const ai = new AI({
  providers: [
    customProvider({
      id: "proxy",
      local: false,
      generate: async ({ prompt, system }) => {
        const res = await fetch("/api/ai", {
          method: "POST",
          body: JSON.stringify({ prompt, system }),
        });
        return (await res.json()).text;
      },
    }),
  ],
});
```

Implement only `generate` and BAI synthesizes `serialize`/`classify`/`extract`/`replace` on top. Provide native `serialize`/`classify`/etc. and BAI will prefer them.

### Fallback provider (last resort)

`fallbackProvider(...)` is a custom provider that BAI always tries **after every other provider** — overriding `priority` and `policy`, and surviving the `local-only` filter. It's the place to handle "no on-device AI available": call your backend, a hosted LLM, or return a hardcoded result / friendly error.

```ts
import { AI, chromeAI, fallbackProvider } from "@coodde/bai";

const ai = new AI({
  providers: [
    chromeAI(), // tried first when present
    fallbackProvider({
      // only reached if chromeAI is unavailable or fails
      generate: async ({ prompt, system }) => {
        const res = await fetch("/api/ai", {
          method: "POST",
          body: JSON.stringify({ prompt, system }),
        });
        if (!res.ok) throw new Error("backend unavailable");
        return (await res.json()).text;
      },
    }),
  ],
});

ai.route("serialize"); // ["chrome", "fallback"] — fallback is always last
```

Because the fallback only needs `generate`, the structured methods (`serialize`, `classify`, etc.) work through it automatically. If even the fallback throws, the call rejects with `NoProviderError`.

## Examples

See [`example/`](./example):

- [`basic.ts`](./example/basic.ts) — structured extraction
- [`forms.ts`](./example/forms.ts) — classify + extract for form routing
- [`replace.ts`](./example/replace.ts) — inline text rewriting
- [`chat.ts`](./example/chat.ts) — streaming chat with fallback
- [`fallback.ts`](./example/fallback.ts) — last-resort backend / graceful degradation

## Development

```bash
npm install
npm test          # vitest (jsdom) — routing, serialize, classify, extract, replace, providers
npm run typecheck # tsc --noEmit
npm run build     # tsup → dist/ (ESM + CJS + d.ts)
```

## Non-goals

No agent system, no toolchains, no orchestration graphs, no LangChain-style abstraction trees, no backend requirement, no API keys stored in the browser.

## License

MIT
