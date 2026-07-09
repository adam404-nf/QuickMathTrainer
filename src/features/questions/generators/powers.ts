import { powersCompositeTemplates, powersTemplates } from "../templates";
import type { CalculationTemplateKind } from "../calculationTemplates";
import { generateFromTemplates } from "./utils";
import type { GenerateQuestionInput, Question } from "../types";

const POWER_OR_ROOT_KINDS = new Set<CalculationTemplateKind>([
  "square",
  "cube",
  "fourth-power",
  "square-root",
  "cube-root",
  "fourth-root",
  "decimal-square",
]);

function hasPowerOrRootTemplate(question: Question): boolean {
  return (question.costTemplates ?? []).some((template) => POWER_OR_ROOT_KINDS.has(template.kind));
}

export function generatePowersQuestion(input: GenerateQuestionInput): Question | undefined {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const question = generateFromTemplates([...powersTemplates, ...powersCompositeTemplates], input);
    if (!question) {
      return undefined;
    }
    if (hasPowerOrRootTemplate(question)) {
      return question;
    }
  }
  return undefined;
}
