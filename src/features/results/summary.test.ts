import { describe, expect, it } from "vitest";
import type { Attempt } from "./types";
import { createSessionSummary } from "./summary";

const baseAttempt: Attempt = {
  id: "attempt-1",
  question: {
    id: "q-1",
    kind: "fill-in",
    type: "arithmetic",
    prompt: "2 + 2 = ?",
    answer: "4",
    difficulty: "easy",
    tags: ["addition"],
    mentalCost: 1,
    strategy: "add",
  },
  questionId: "q-1",
  questionType: "arithmetic",
  userAnswer: "4",
  correctAnswer: "4",
  isCorrect: true,
  timeMs: 1000,
  createdAt: "2026-06-21T00:00:00.000Z",
};

describe("createSessionSummary", () => {
  it("calculates accuracy, average time, and mistakes", () => {
    const wrongAttempt: Attempt = {
      ...baseAttempt,
      id: "attempt-2",
      questionId: "q-2",
      userAnswer: "5",
      isCorrect: false,
      timeMs: 3000,
    };

    const summary = createSessionSummary([baseAttempt, wrongAttempt]);

    expect(summary.totalQuestions).toBe(2);
    expect(summary.correctCount).toBe(1);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.averageTimeMs).toBe(2000);
    expect(summary.mistakes).toEqual([wrongAttempt]);
  });
});
