import type { Difficulty, MentalCost, Question } from "./types";

const maxMentalCostByDifficulty: Record<Difficulty, MentalCost> = {
  easy: 2,
  medium: 3,
  hard: 5,
};

export function isQuestionValid(
  question: Question,
  difficulty: Difficulty,
  seenQuestionIds: Set<string>,
): boolean {
  if (seenQuestionIds.has(question.id)) {
    return false;
  }

  if (question.mentalCost > maxMentalCostByDifficulty[difficulty]) {
    return false;
  }

  if (question.kind === "multiple-choice") {
    return question.options?.length === 4 && new Set(question.options).size === 4;
  }

  return true;
}
