import type { Difficulty, MentalCost, Question } from "./types";

// Upper bounds by difficulty — tuned for senior secondary (IAL / DSE / 高考) mental-math pace.
// easy: warm-up with occasional two- to multi-step items (1–4)
// medium: default exam-prep band; allow challenge items (1–5)
// hard: full challenge range (1–5)
const maxMentalCostByDifficulty: Record<Difficulty, MentalCost> = {
  easy: 4,
  medium: 5,
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
