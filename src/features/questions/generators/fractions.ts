import { fractionTemplates } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";

export function generateFractionQuestion(input: GenerateQuestionInput): Question {
  const template = pickOne(fractionTemplates);
  return template({
    difficulty: input.difficulty,
    kind: chooseQuestionKind(),
  });
}
