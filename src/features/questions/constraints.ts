import type { Difficulty, Question } from "./types";

export function isQuestionValid(
  question: Question,
  _difficulty: Difficulty,
  seenQuestionIds: Set<string>,
): boolean {
  if (seenQuestionIds.has(question.id)) {
    return false;
  }

  if (question.kind === "multiple-choice") {
    return (
      question.options?.length === 4 &&
      new Set(question.options).size === 4 &&
      question.options.includes(question.answer)
    );
  }

  return true;
}
