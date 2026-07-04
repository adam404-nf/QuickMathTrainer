import { fractionTemplates } from "../templates";
import { generateFromTemplates } from "./utils";
import type { GenerateQuestionInput, Question } from "../types";

export function generateFractionQuestion(input: GenerateQuestionInput): Question {
  return generateFromTemplates(fractionTemplates, input);
}
