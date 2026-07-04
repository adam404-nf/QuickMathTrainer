import { powersTemplates } from "../templates";
import { generateFromTemplates } from "./utils";
import type { GenerateQuestionInput, Question } from "../types";

export function generatePowersQuestion(input: GenerateQuestionInput): Question {
  return generateFromTemplates(powersTemplates, input);
}
