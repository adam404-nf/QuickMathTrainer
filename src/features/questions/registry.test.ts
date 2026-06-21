import { describe, expect, it } from "vitest";
import { availableQuestionTypes, generateQuestion } from "./registry";

describe("question registry", () => {
  it("exposes the first MVP generator group", () => {
    expect(availableQuestionTypes).toEqual(["arithmetic", "fractions", "powers"]);
  });

  it("generates a valid mixed practice question", () => {
    const question = generateQuestion({
      mode: "mixed",
      difficulty: "easy",
      context: {
        recentQuestionIds: [],
        seenQuestionIds: new Set(),
      },
    });

    expect(question.prompt).toContain("?");
    expect(question.answer).not.toHaveLength(0);
    expect(availableQuestionTypes).toContain(question.type);
  });
});
