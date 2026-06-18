import { describe, it, expect, vi } from "vitest";
import { AI, mockProvider } from "../src/index.js";

describe("serialize", () => {
  it("serialize should return a structured object", async () => {
    const ai = new AI({
      providers: [
        mockProvider({
          id: "mock",
          respond: JSON.stringify({
            customerName: "John",
            orderId: "123",
            urgency: "high",
          }),
        }),
      ],
    });

    const result = await ai.serialize("...", {
      customerName: "string",
      orderId: "string",
      urgency: ["low", "medium", "high"] as const,
    });

    expect(result).toEqual({
      customerName: "John",
      orderId: "123",
      urgency: "high",
    });
  });

  it("strips markdown fences and surrounding chatter", async () => {
    const ai = new AI({
      providers: [
        mockProvider({
          respond:
            'Here you go:\n```json\n{"name":"Ada","count":3}\n```\nHope that helps!',
        }),
      ],
    });

    const result = await ai.serialize("...", {
      name: "string",
      count: "number",
    });
    expect(result).toEqual({ name: "Ada", count: 3 });
  });

  it("coerces primitive types (string→number, string→boolean)", async () => {
    const ai = new AI({
      providers: [
        mockProvider({
          respond: JSON.stringify({ qty: "42", active: "yes" }),
        }),
      ],
    });

    const result = await ai.serialize("...", {
      qty: "number",
      active: "boolean",
    });
    expect(result).toEqual({ qty: 42, active: true });
  });

  it("matches enum values case-insensitively", async () => {
    const ai = new AI({
      providers: [mockProvider({ respond: JSON.stringify({ urgency: "HIGH" }) })],
    });
    const result = await ai.serialize("...", {
      urgency: ["low", "medium", "high"] as const,
    });
    expect(result.urgency).toBe("high");
  });

  it("rejects enum values outside the allowed set (then has no fallback)", async () => {
    const ai = new AI({
      providers: [
        mockProvider({ respond: JSON.stringify({ urgency: "extreme" }) }),
      ],
    });
    await expect(
      ai.serialize("...", { urgency: ["low", "high"] as const }),
    ).rejects.toThrow();
  });

  it("supports nested object schemas", async () => {
    const ai = new AI({
      providers: [
        mockProvider({
          respond: JSON.stringify({
            name: "Order",
            customer: { name: "Bea", vip: true },
          }),
        }),
      ],
    });
    const result = await ai.serialize("...", {
      name: "string",
      customer: { name: "string", vip: "boolean" },
    });
    expect(result).toEqual({
      name: "Order",
      customer: { name: "Bea", vip: true },
    });
  });

  it("falls back to a second provider when the first returns junk", async () => {
    const bad = mockProvider({ id: "chrome", respond: "not json at all" });
    const good = mockProvider({
      id: "ollama",
      respond: JSON.stringify({ name: "ok" }),
    });
    const ai = new AI({ providers: [bad, good] });

    const result = await ai.serialize("...", { name: "string" });
    expect(result).toEqual({ name: "ok" });
  });

  it("prefers a provider's native serialize implementation", async () => {
    const native = vi.fn().mockResolvedValue({ name: "native" });
    const provider = mockProvider({ id: "chrome" });
    provider.serialize = native;
    const ai = new AI({ providers: [provider] });

    const result = await ai.serialize("...", { name: "string" });
    expect(native).toHaveBeenCalledOnce();
    expect(result).toEqual({ name: "native" });
  });
});
