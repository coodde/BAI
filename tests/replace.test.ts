import { describe, it, expect } from "vitest";
import { AI, mockProvider } from "../src/index.js";

describe("replace", () => {
  it("should rewrite text properly", async () => {
    const ai = new AI({
      providers: [
        mockProvider({
          respond: "I have a problem with my order.",
        }),
      ],
    });
    const result = await ai.replace(
      "I has problem with order",
      "fix grammar and make professional",
    );
    expect(result).toBe("I have a problem with my order.");
  });

  it("strips surrounding quotes the model may add", async () => {
    const ai = new AI({
      providers: [mockProvider({ respond: '"Please review the attached file."' })],
    });
    const result = await ai.replace("see file", "make it polite");
    expect(result).toBe("Please review the attached file.");
  });

  it("strips markdown code fences", async () => {
    const ai = new AI({
      providers: [mockProvider({ respond: "```\nclean text\n```" })],
    });
    expect(await ai.replace("x", "y")).toBe("clean text");
  });

  it("passes the instruction into the generated prompt", async () => {
    let seenPrompt = "";
    const ai = new AI({
      providers: [
        mockProvider({
          respond: (prompt) => {
            seenPrompt = prompt;
            return "ok";
          },
        }),
      ],
    });
    await ai.replace("hello", "translate to French");
    expect(seenPrompt).toContain("translate to French");
    expect(seenPrompt).toContain("hello");
  });
});
