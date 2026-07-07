import { isFiniteDecimalString } from "./answerPath";
import { hasTerminatingDecimal, isSimplestFractionString } from "./fractionMath";
import type { Difficulty, Question } from "./types";
import { parseNumericAnswer } from "./utils";

function promptMatchesAnswerFormat(question: Question): boolean {
  if (!question.answerFormat) {
    return true;
  }

  const suffix = question.answerFormat === "decimal" ? "（小數）" : "（分數）";
  return question.prompt.includes(suffix);
}

function answerMatchesFormat(question: Question): boolean {
  if (!question.answerFormat) {
    return true;
  }

  if (question.answerFormat === "fraction") {
    return isSimplestFractionString(question.answer);
  }

  const value = parseNumericAnswer(question.answer);
  return value !== undefined && hasTerminatingDecimal(value);
}

function optionsMatchFormat(question: Question): boolean {
  if (question.kind !== "multiple-choice" || !question.options) {
    return true;
  }

  if (!question.answerFormat) {
    return true;
  }

  return question.options.every((option) => {
    if (question.answerFormat === "fraction") {
      return isSimplestFractionString(option) || Number.isInteger(parseNumericAnswer(option) ?? NaN);
    }
    return isFiniteDecimalString(option) || Number.isInteger(parseNumericAnswer(option) ?? NaN);
  });
}

export function isQuestionValid(
  question: Question,
  _difficulty: Difficulty,
  seenQuestionIds: Set<string>,
): boolean {
  if (seenQuestionIds.has(question.id)) {
    return false;
  }

  if (question.needsAnswerPath) {
    return false;
  }

  if (question.answerFormat && !promptMatchesAnswerFormat(question)) {
    return false;
  }

  if (!answerMatchesFormat(question)) {
    return false;
  }

  if (!optionsMatchFormat(question)) {
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
