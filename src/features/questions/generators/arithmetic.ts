import { arithmeticTemplates } from "../templates";
import { generateFromTemplates } from "./utils";
import type { GenerateQuestionInput, Question } from "../types";

export function generateArithmeticQuestion(input: GenerateQuestionInput): Question {
  return generateFromTemplates(arithmeticTemplates, input);
}
