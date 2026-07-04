import { describe, expect, it } from "vitest";
import type { Attempt } from "./types";
import { createSessionSummary } from "./summary";
import { createWeaknessBreakdown } from "./weakness";

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
  it("calculates accuracy, average time, mistakes, and weakness breakdown", () => {
    const wrongAttempt: Attempt = {
      ...baseAttempt,
      id: "attempt-2",
      questionId: "q-2",
      question: {
        ...baseAttempt.question,
        id: "q-2",
        prompt: "3 × 4 = ?",
        answer: "12",
        tags: ["multiplication"],
      },
      questionType: "arithmetic",
      userAnswer: "13",
      isCorrect: false,
      timeMs: 9000,
    };

    const summary = createSessionSummary([baseAttempt, wrongAttempt], "easy");

    expect(summary.totalQuestions).toBe(2);
    expect(summary.correctCount).toBe(1);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.averageTimeMs).toBe(5000);
    expect(summary.mistakes).toEqual([wrongAttempt]);
    expect(summary.weakness.byTag.some((metric) => metric.key === "multiplication")).toBe(true);
  });
});

describe("createWeaknessBreakdown", () => {
  it("marks weak tags when accuracy or time thresholds fail", () => {
    const slowWrong: Attempt = {
      ...baseAttempt,
      id: "attempt-2",
      questionId: "q-2",
      question: {
        ...baseAttempt.question,
        id: "q-2",
        tags: ["multiplication"],
      },
      userAnswer: "5",
      isCorrect: false,
      timeMs: 7000,
    };
    const slowCorrect: Attempt = {
      ...baseAttempt,
      id: "attempt-3",
      questionId: "q-3",
      question: {
        ...baseAttempt.question,
        id: "q-3",
        tags: ["multiplication"],
      },
      isCorrect: true,
      timeMs: 7000,
    };

    const breakdown = createWeaknessBreakdown([slowWrong, slowCorrect], "easy");
    const multiplication = breakdown.byTag.find((metric) => metric.key === "multiplication");

    expect(multiplication?.status).toBe("weak");
    expect(breakdown.weakTags.some((metric) => metric.key === "multiplication")).toBe(true);
  });

  it("marks insufficient data when sample count is below two", () => {
    const breakdown = createWeaknessBreakdown([baseAttempt], "easy");
    const addition = breakdown.byTag.find((metric) => metric.key === "addition");

    expect(addition?.status).toBe("insufficient_data");
    expect(breakdown.weakTags).toHaveLength(0);
  });
});
