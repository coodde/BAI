import { describe, it, expect, vi } from "vitest";
import { AI, mockProvider, fallbackProvider } from "../src/index.js";

describe("fallbackProvider", () => {
  it("is always routed last, even when registered first", () => {
    const ai = new AI({
      providers: [
        fallbackProvider({ id: "backend", generate: async () => "x" }),
        mockProvider({ id: "chrome" }),
        mockProvider({ id: "ollama" }),
      ],
    });
    expect(ai.route("chat")).toEqual(["chrome", "ollama", "backend"]);
  });

  it("is routed last even when it has the highest provider priority", () => {
    const ai = new AI({
      providers: [
        fallbackProvider({
          id: "backend",
          priority: 999,
          generate: async () => "x",
        }),
        mockProvider({ id: "chrome", priority: 1 }),
      ],
    });
    expect(ai.route("chat")).toEqual(["chrome", "backend"]);
  });

  it("is routed last even when listed first in the priority config", () => {
    const ai = new AI({
      providers: [
        fallbackProvider({ id: "backend", generate: async () => "x" }),
        mockProvider({ id: "chrome" }),
      ],
      priority: { chat: ["backend", "chrome"] },
    });
    expect(ai.route("chat")).toEqual(["chrome", "backend"]);
  });

  it("survives the local-only policy despite not being local", () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", local: true }),
        mockProvider({ id: "ollama", local: false }),
        fallbackProvider({ id: "backend", generate: async () => "x" }),
      ],
      policy: { mode: "local-only" },
    });
    // ollama (non-local) excluded; backend (fallback) kept and last.
    expect(ai.route("chat")).toEqual(["chrome", "backend"]);
  });

  it("handles the request when every other provider fails", async () => {
    const backend = vi.fn(async () => "from-backend");
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", fail: "no chrome ai" }),
        mockProvider({ id: "ollama", fail: "offline" }),
        fallbackProvider({ id: "backend", generate: backend }),
      ],
    });

    expect(await ai.message("hello")).toBe("from-backend");
    expect(backend).toHaveBeenCalledOnce();
  });

  it("is NOT used when an earlier provider succeeds", async () => {
    const backend = vi.fn(async () => "from-backend");
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", respond: "from-chrome" }),
        fallbackProvider({ id: "backend", generate: backend }),
      ],
    });

    expect(await ai.message("hi")).toBe("from-chrome");
    expect(backend).not.toHaveBeenCalled();
  });

  it("can synthesize serialize/classify on top of its generate", async () => {
    const ai = new AI({
      providers: [
        mockProvider({ id: "chrome", fail: "down" }),
        fallbackProvider({
          id: "backend",
          generate: async () => JSON.stringify({ name: "Ada" }),
        }),
      ],
    });
    expect(await ai.serialize("...", { name: "string" })).toEqual({ name: "Ada" });
  });

  it("defaults id to 'fallback' and local to false", () => {
    const provider = fallbackProvider({ generate: async () => "x" });
    expect(provider.id).toBe("fallback");
    expect(provider.local).toBe(false);
    expect(provider.fallback).toBe(true);
  });
});
