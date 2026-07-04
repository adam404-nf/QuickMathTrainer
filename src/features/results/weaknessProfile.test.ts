import { describe, expect, it } from "vitest";
import type { Attempt, PracticeHistoryEntry } from "./types";
import { deriveWeaknessTargets } from "./weaknessProfile";

function makeAttempt(id: string, tags: string[], isCorrect: boolean, timeMs: number): Attempt {
  return {
    id,
    question: {
      id: `q-${id}`,
      kind: "fill-in",
      type: "arithmetic",
      prompt: "1 + 1 = ?",
      answer: "2",
      difficulty: "easy",
      tags,
      mentalCost: 1,
      strategy: "add",
    },
    questionId: `q-${id}`,
    questionType: "arithmetic",
    userAnswer: isCorrect ? "2" : "3",
    correctAnswer: "2",
    isCorrect,
    timeMs,
    createdAt: "2026-06-21T00:00:00.000Z",
  };
}

function makeHistoryEntry(attempts: Attempt[]): PracticeHistoryEntry {
  return {
    id: `session-${attempts.length}`,
    mode: "mixed",
    difficulty: "easy",
    startedAt: "2026-06-21T00:00:00.000Z",
    endedAt: "2026-06-21T00:05:00.000Z",
    attempts,
    summary: {
      totalQuestions: attempts.length,
      correctCount: attempts.filter((attempt) => attempt.isCorrect).length,
      accuracy: 0,
      averageTimeMs: 0,
      mistakes: [],
      weakness: {
        byType: [],
        byTag: [],
        weakTypes: [],
        weakTags: [],
        hasInsufficientSample: true,
      },
    },
  };
}

describe("deriveWeaknessTargets", () => {
  it("returns not ready when history has fewer than ten attempts", () => {
    const history = [makeHistoryEntry(Array.from({ length: 5 }, (_, index) => makeAttempt(String(index), ["addition"], true, 1000)))];

    const targets = deriveWeaknessTargets(history, "easy");

    expect(targets.isReady).toBe(false);
    expect(targets.message).toContain("先完成幾輪混合練習");
  });

  it("returns up to three weak tags from recent history", () => {
    const attempts = [
      ...Array.from({ length: 4 }, (_, index) =>
        makeAttempt(`mul-wrong-${index}`, ["multiplication"], false, 7000),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        makeAttempt(`mul-slow-${index}`, ["multiplication"], true, 7000),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        makeAttempt(`add-${index}`, ["addition"], true, 1000),
      ),
    ];

    const targets = deriveWeaknessTargets([makeHistoryEntry(attempts)], "easy");

    expect(targets.isReady).toBe(true);
    expect(targets.tags).toContain("multiplication");
    expect(targets.tags.length).toBeLessThanOrEqual(3);
  });
});
