import { describe, it, expect } from "vitest";
import { AI, mockProvider } from "../src/index.js";

describe("extract", () => {
  it("returns only the requested fields", async () => {
    const ai = new AI({
      providers: [
        mockProvider({
          respond: JSON.stringify({
            email: "a@b.com",
            orderId: "ORD-1",
            extra: "ignored",
          }),
        }),
      ],
    });
    const result = await ai.extract("...", ["email", "orderId"]);
    expect(result).toEqual({ email: "a@b.com", orderId: "ORD-1" });
  });

  it("omits absent or empty fields (partial result)", async () => {
    const ai = new AI({
      providers: [
        mockProvider({ respond: JSON.stringify({ email: "a@b.com", orderId: "" }) }),
      ],
    });
    const result = await ai.extract("...", ["email", "orderId"]);
    expect(result).toEqual({ email: "a@b.com" });
  });

  it("returns an empty object when no JSON object is produced", async () => {
    const ai = new AI({ providers: [mockProvider({ respond: "[]" })] });
    const result = await ai.extract("...", ["email"]);
    expect(result).toEqual({});
  });
});
