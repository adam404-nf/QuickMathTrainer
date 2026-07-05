import { describe, expect, it } from "vitest";
import { isQuestionValid } from "./constraints";
import type { Question } from "./types";

const baseQuestion: Question = {
  id: "q-test",
  kind: "fill-in",
  type: "arithmetic",
  prompt: "1 + 1 = ?",
  answer: "2",
  difficulty: "easy",
  tags: ["addition"],
  mentalCost: 3,
  technique: { name: "加法", steps: ["1 + 1 = 2"] },
};

describe("isQuestionValid", () => {
  it("accepts fill-in questions regardless of mentalCost", () => {
    expect(isQuestionValid({ ...baseQuestion, mentalCost: 1 }, "easy", new Set())).toBe(true);
    expect(isQuestionValid({ ...baseQuestion, mentalCost: 11 }, "hard", new Set())).toBe(true);
  });

  it("rejects duplicate question ids", () => {
    expect(isQuestionValid(baseQuestion, "easy", new Set(["q-test"]))).toBe(false);
  });

  it("validates multiple-choice options", () => {
    expect(
      isQuestionValid(
        {
          ...baseQuestion,
          kind: "multiple-choice",
          options: ["2", "3", "4", "5"],
        },
        "easy",
        new Set(),
      ),
    ).toBe(true);

    expect(
      isQuestionValid(
        {
          ...baseQuestion,
          kind: "multiple-choice",
          options: ["2", "2", "3", "4"],
        },
        "easy",
        new Set(),
      ),
    ).toBe(false);

    expect(
      isQuestionValid(
        {
          ...baseQuestion,
          kind: "multiple-choice",
          options: ["3", "4", "5", "6"],
        },
        "easy",
        new Set(),
      ),
    ).toBe(false);
  });
});
