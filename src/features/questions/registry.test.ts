import { describe, expect, it } from "vitest";
import { availableQuestionTypes, generateQuestion, questionMatchesTargets } from "./registry";

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

  it("generates multi-step templates with diagnostic tags", () => {
    let foundMultiStep = false;

    for (let index = 0; index < 40; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      if (question.tags.includes("order-of-operations")) {
        foundMultiStep = true;
        break;
      }
    }

    expect(foundMultiStep).toBe(true);
  });

  it("prefers questions that match weakness-focused target tags", () => {
    let matched = 0;

    for (let index = 0; index < 20; index += 1) {
      const question = generateQuestion({
        mode: "weakness-focused",
        difficulty: "easy",
        targetTags: ["absolute-value"],
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      if (questionMatchesTargets(question, ["absolute-value"])) {
        matched += 1;
      }
    }

    expect(matched).toBeGreaterThan(0);
  });
});
