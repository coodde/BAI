import { describe, it, expect, vi } from "vitest";
import { AI, ollama, chromeAI, customProvider } from "../src/index.js";

describe("ollama provider", () => {
  it("calls /api/generate and returns the response text", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/api/generate")) {
        return new Response(JSON.stringify({ response: "hi from llama" }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 200 });
    });

    const ai = new AI({
      providers: [ollama({ fetch: fetchMock as unknown as typeof fetch })],
    });
    const out = await ai.message("hello");
    expect(out).toBe("hi from llama");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/generate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses /api/chat for multi-turn chat", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: { content: "chat reply" } }), {
          status: 200,
        }),
    );
    const ai = new AI({
      providers: [ollama({ fetch: fetchMock as unknown as typeof fetch })],
    });
    const result = await ai.chat({
      messages: [{ role: "user", content: "hey" }],
    });
    expect(result.text).toBe("chat reply");
    expect(result.provider).toBe("ollama");
    expect(result.messages).toHaveLength(2);
  });

  it("reports unavailable when the tags endpoint fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const provider = ollama({ fetch: fetchMock as unknown as typeof fetch });
    expect(await provider.isAvailable!()).toBe(false);
  });
});

describe("chrome provider", () => {
  it("is unavailable when no Prompt API global exists", async () => {
    const provider = chromeAI();
    expect(await provider.isAvailable!()).toBe(false);
  });

  it("generates via an injected factory", async () => {
    const factory = {
      availability: async () => "available",
      create: async () => ({
        prompt: async (text: string) => `echo:${text}`,
      }),
    };
    const ai = new AI({ providers: [chromeAI({ factory })] });
    expect(await ai.message("ping")).toBe("echo:ping");
  });
});

describe("custom provider", () => {
  it("wraps a user generate function and exposes default chat", async () => {
    const provider = customProvider({
      id: "proxy",
      generate: async ({ prompt }) => `g:${prompt}`,
    });
    const ai = new AI({ providers: [provider] });

    expect(await ai.message("x")).toBe("g:x");
    const chat = await ai.chat({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(chat.text).toContain("g:");
    expect(chat.provider).toBe("proxy");
  });
});
