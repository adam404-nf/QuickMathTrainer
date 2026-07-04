import type { Difficulty } from "../questions/types";
import type { Attempt, SessionSummary } from "./types";
import { createWeaknessBreakdown } from "./weakness";

export function createSessionSummary(
  attempts: readonly Attempt[],
  difficulty: Difficulty,
): SessionSummary {
  const totalQuestions = attempts.length;
  const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
  const totalTimeMs = attempts.reduce((sum, attempt) => sum + attempt.timeMs, 0);

  return {
    totalQuestions,
    correctCount,
    accuracy: totalQuestions === 0 ? 0 : correctCount / totalQuestions,
    averageTimeMs: totalQuestions === 0 ? 0 : Math.round(totalTimeMs / totalQuestions),
    mistakes: attempts.filter((attempt) => !attempt.isCorrect),
    weakness: createWeaknessBreakdown(attempts, difficulty),
  };
}
