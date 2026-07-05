import { describe, expect, it, vi } from "vitest";
import type { PracticeSession } from "../../features/practice/types";
import {
  EXIT_PRACTICE_CONFIRM_MESSAGE,
  confirmExitPractice,
  shouldConfirmExitPractice,
} from "./practiceNavigation";

function makeActiveSession(attemptCount = 0, currentIndex = 0): PracticeSession {
  return {
    id: "session-test",
    preferences: {
      mode: "mixed",
      difficulty: "easy",
      sessionLength: "short",
      questionLimit: 10,
      selectedQuestionTypes: ["arithmetic", "fractions", "powers"],
    },
    currentQuestion: {
      id: "q-1",
      kind: "fill-in",
      type: "arithmetic",
      prompt: "1 + 1 = ?",
      answer: "2",
      difficulty: "easy",
      tags: ["addition"],
      mentalCost: 1,
      strategy: "add",
    },
    currentIndex,
    attempts: Array.from({ length: attemptCount }, (_, index) => ({
      id: `attempt-${index}`,
      question: {
        id: `q-${index}`,
        kind: "fill-in" as const,
        type: "arithmetic" as const,
        prompt: "1 + 1 = ?",
        answer: "2",
        difficulty: "easy" as const,
        tags: ["addition"],
        mentalCost: 1 as const,
        strategy: "add",
      },
      questionId: `q-${index}`,
      questionType: "arithmetic" as const,
      userAnswer: "2",
      correctAnswer: "2",
      isCorrect: true,
      timeMs: 1000,
      createdAt: "2026-06-21T00:00:00.000Z",
    })),
    startedAt: "2026-06-21T00:00:00.000Z",
    questionStartedAt: 0,
    status: "active",
  };
}

describe("practiceNavigation", () => {
  it("does not require confirmation before any progress is made", () => {
    expect(shouldConfirmExitPractice(makeActiveSession(), undefined)).toBe(false);
  });

  it("requires confirmation after at least one answered question", () => {
    expect(shouldConfirmExitPractice(makeActiveSession(1), undefined)).toBe(true);
  });

  it("asks for confirmation through the shared confirm helper", () => {
    const confirm = vi.fn(() => true);

    expect(confirmExitPractice(makeActiveSession(1), undefined, confirm)).toBe(true);
    expect(confirm).toHaveBeenCalledWith(EXIT_PRACTICE_CONFIRM_MESSAGE);
  });

  it("blocks exit when the user cancels confirmation", () => {
    const confirm = vi.fn(() => false);

    expect(confirmExitPractice(makeActiveSession(1), undefined, confirm)).toBe(false);
  });
});
