import { describe, it, expect } from "vitest";
import { AI, mockProvider } from "../src/index.js";

describe("classify", () => {
  it("returns the best label for an exact response", async () => {
    const ai = new AI({ providers: [mockProvider({ respond: "bug" })] });
    const label = await ai.classify("the app crashes", [
      "bug",
      "feature",
      "question",
    ]);
    expect(label).toBe("bug");
  });

  it("matches case-insensitively", async () => {
    const ai = new AI({ providers: [mockProvider({ respond: "FEATURE" })] });
    expect(await ai.classify("...", ["bug", "feature"])).toBe("feature");
  });

  it("extracts a label embedded in a verbose response", async () => {
    const ai = new AI({
      providers: [
        mockProvider({ respond: "I think this is a question about usage." }),
      ],
    });
    expect(await ai.classify("...", ["bug", "feature", "question"])).toBe(
      "question",
    );
  });

  it("strips quotes around the label", async () => {
    const ai = new AI({ providers: [mockProvider({ respond: '"feature"' })] });
    expect(await ai.classify("...", ["bug", "feature"])).toBe("feature");
  });

  it("throws when at least one label is not provided", async () => {
    const ai = new AI({ providers: [mockProvider({ respond: "x" })] });
    await expect(ai.classify("...", [])).rejects.toThrow(/at least one label/);
  });

  it("falls back when the first provider returns an unmatchable label", async () => {
    const bad = mockProvider({ id: "chrome", respond: "totally-unrelated" });
    const good = mockProvider({ id: "ollama", respond: "bug" });
    const ai = new AI({ providers: [bad, good] });
    expect(await ai.classify("...", ["bug", "feature"])).toBe("bug");
  });
});
