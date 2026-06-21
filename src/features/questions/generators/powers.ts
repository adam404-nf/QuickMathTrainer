import { powersTemplates } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";

export function generatePowersQuestion(input: GenerateQuestionInput): Question {
  const template = pickOne(powersTemplates);
  return template({
    difficulty: input.difficulty,
    kind: chooseQuestionKind(),
  });
}
