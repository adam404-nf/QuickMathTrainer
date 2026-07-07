import { describe, expect, it } from "vitest";
import { appendCostStep, MAX_APPEND_STEPS } from "./appendStep";
import { tryExtendQuestion } from "./utils";
import { costRangeForDifficulty } from "../mentalCost";
import type { Question } from "../types";

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "test",
    kind: "fill-in",
    type: "arithmetic",
    prompt: "3 + 4 = ?",
    answer: "7",
    difficulty: "hard",
    tags: ["addition"],
    mentalCost: 1,
    costTemplates: [{ kind: "integer-add", a: 3, b: 4 }],
    technique: { name: "加法", steps: ["3 + 4 = 7"] },
    ...overrides,
  };
}

describe("appendCostStep", () => {
  it("appends an integer step to a low-cost question", () => {
    const question = baseQuestion();
    const extended = appendCostStep(question);

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBeGreaterThan(question.costTemplates!.length);
    expect(extended!.mentalCost).toBeGreaterThan(question.mentalCost);
    expect(extended!.prompt).not.toBe(question.prompt);
  });

  it("keeps appending until the target range is reached", () => {
    const question = baseQuestion({ difficulty: "hard", mentalCost: 1 });
    const bucket = costRangeForDifficulty("hard");
    const extended = tryExtendQuestion(question, {
      mode: "arithmetic",
      difficulty: "hard",
      context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      targetMentalCostBucket: bucket,
    });

    expect(extended.mentalCost).toBeGreaterThanOrEqual(bucket.min);
    expect(extended.mentalCost).toBeLessThanOrEqual(bucket.max);
    expect(extended.costTemplates!.length).toBeGreaterThan(1);
  });

  it("allows more than three appended templates", () => {
    let current = baseQuestion({ difficulty: "easy", mentalCost: 1 });
    let appendCount = 0;

    while (appendCount < MAX_APPEND_STEPS) {
      const next = appendCostStep(current);
      if (!next || next.mentalCost <= current.mentalCost) {
        break;
      }
      current = next;
      appendCount += 1;
    }

    expect(appendCount).toBeGreaterThan(3);
  });
});
