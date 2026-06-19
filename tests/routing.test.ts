import { describe, it, expect, vi } from "vitest";
import { AI, mockProvider, NoProviderError } from "../src/index.js";

describe("routing", () => {
  it("uses the default fallback chain order (chrome → browserai → webllm → ollama → custom)", () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "custom" }),
        mockProvider({ id: "ollama" }),
        mockProvider({ id: "chrome" }),
        mockProvider({ id: "browserai" }),
        mockProvider({ id: "webllm" }),
      ],
    });
    expect(ai.route("chat")).toEqual([
      "chrome",
      "browserai",
      "webllm",
      "ollama",
      "custom",
    ]);
  });

  it("honours an explicit per-capability priority list", () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome" }),
        mockProvider({ id: "ollama" }),
        mockProvider({ id: "browserai" }),
      ],
      priority: {
        chat: ["ollama", "chrome", "browserai"],
      },
    });
    expect(ai.route("chat")).toEqual(["ollama", "chrome", "browserai"]);
  });

  it("should fallback from chrome → browserAI when chrome fails", async () => {
    const chrome = mockProvider({ id: "chrome", fail: "boom" });
    const browser = mockProvider({ id: "browserai", respond: "from-browser" });
    const ai = new AI({ providers: [chrome, browser] });

    const result = await ai.message("hello");
    expect(result).toBe("from-browser");
  });

  it("skips providers reporting unavailable", async () => {
    const chrome = mockProvider({
      id: "chrome",
      available: false,
      respond: "chrome",
    });
    const ollama = mockProvider({ id: "ollama", respond: "ollama" });
    const ai = new AI({ providers: [chrome, ollama] });

    expect(await ai.message("hi")).toBe("ollama");
  });

  it("caches failures so a failed provider is skipped on the next call", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("down"));
    const chrome = mockProvider({ id: "chrome" });
    chrome.generate = generate;
    const ollama = mockProvider({ id: "ollama", respond: "ok" });
    const ai = new AI({ providers: [chrome, ollama] });

    await ai.message("one");
    await ai.message("two");

    // chrome.generate attempted only on the first call; second call skips it.
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("respects failureTtl=0 (no caching, retries every call)", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("down"));
    const chrome = mockProvider({ id: "chrome" });
    chrome.generate = generate;
    const ollama = mockProvider({ id: "ollama", respond: "ok" });
    const ai = new AI({ providers: [chrome, ollama], failureTtl: 0 });

    await ai.message("one");
    await ai.message("two");

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("local-only policy excludes non-local providers", () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", local: true }),
        mockProvider({ id: "ollama", local: false }),
      ],
      policy: { mode: "local-only" },
    });
    expect(ai.route("chat")).toEqual(["chrome"]);
  });

  it("fastest policy orders by performance score", () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", performance: 0.3 }),
        mockProvider({ id: "ollama", performance: 0.9 }),
        mockProvider({ id: "webllm", performance: 0.6 }),
      ],
      policy: { mode: "fastest" },
    });
    expect(ai.route("chat")).toEqual(["ollama", "webllm", "chrome"]);
  });

  it("throws NoProviderError when every candidate fails", async () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", fail: "a" }),
        mockProvider({ id: "ollama", fail: "b" }),
      ],
    });
    await expect(ai.message("hi")).rejects.toBeInstanceOf(NoProviderError);
  });

  it("excludes providers lacking a capability natively or synthetically", () => {
    const ai = new AI({
      providers: [
        // chat-only provider with no generate cannot synthesise serialize.
        {
          id: "chatonly",
          capabilities: {
            chat: true,
            serialize: false,
            classify: false,
            extract: false,
            replace: false,
          },
          chat: async () => ({ text: "", provider: "chatonly", messages: [] }),
          generate: undefined as never,
        },
        mockProvider({ id: "ollama" }),
      ],
    });
    expect(ai.route("serialize")).toEqual(["ollama"]);
  });

  it("rejects duplicate provider ids", () => {
    expect(
      () =>
        new AI({
          providers: [mockProvider({ id: "x" }), mockProvider({ id: "x" })],
        }),
    ).toThrow(/Duplicate provider id/);
  });

  it("requires at least one provider", () => {
    expect(() => new AI({ providers: [] })).toThrow(/at least one provider/);
  });

  it("defaults to a browser-native provider (chrome) when none are given", () => {
    const ai = new AI();
    expect(ai.route("chat")).toEqual(["chrome"]);
    expect(Object.keys(ai.capabilities())).toEqual(["chrome"]);
  });

  it("defaults providers when given an empty config object", () => {
    const ai = new AI({});
    expect(ai.route("chat")).toEqual(["chrome"]);
  });

  it("throws when config is a non-object", () => {
    expect(() => new AI(42 as never)).toThrow(/must be an object/);
  });

  it("throws a clear error when a factory is passed uncalled", () => {
    // Simulates `providers: [chromeAI]` instead of `[chromeAI()]`.
    const fn = () => ({}) as never;
    expect(
      () => new AI({ providers: [fn as never] }),
    ).toThrow(/forget to call the factory/);
  });

  it("throws a clear error for a non-provider object", () => {
    expect(
      () => new AI({ providers: [{ engine: "gemini" } as never] }),
    ).toThrow(/not a valid provider/);
  });
});
