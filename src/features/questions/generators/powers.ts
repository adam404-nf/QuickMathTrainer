import { powersCompositeTemplates, powersTemplates } from "../templates";
import { generateFromTemplates } from "./utils";
import type { GenerateQuestionInput, Question } from "../types";

export function generatePowersQuestion(input: GenerateQuestionInput): Question | undefined {
  return generateFromTemplates([...powersTemplates, ...powersCompositeTemplates], input);
}
