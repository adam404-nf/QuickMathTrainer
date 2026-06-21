import { arithmeticTemplates } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";

export function generateArithmeticQuestion(input: GenerateQuestionInput): Question {
  const template = pickOne(arithmeticTemplates);
  return template({
    difficulty: input.difficulty,
    kind: chooseQuestionKind(),
  });
}
