import { matchesMentalCostBucket } from "../mentalCost";
import { filterTemplates } from "../templates";
import type { QuestionTemplate } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";

const MAX_TEMPLATE_ATTEMPTS = 100;

export function generateFromTemplates(
  templates: readonly QuestionTemplate[],
  input: GenerateQuestionInput,
): Question | undefined {
  const filtered = filterTemplates(templates, input.targetTags);

  if (input.targetTags && input.targetTags.length > 0 && filtered.length === 0) {
    return undefined;
  }

  const pool = filtered.length > 0 ? filtered : templates;

  for (let attempt = 0; attempt < MAX_TEMPLATE_ATTEMPTS; attempt += 1) {
    const template = pickOne(pool);
    const question = template({
      difficulty: input.difficulty,
      kind: chooseQuestionKind(),
    });

    if (
      !input.targetMentalCostBucket ||
      matchesMentalCostBucket(question.mentalCost, input.targetMentalCostBucket)
    ) {
      return question;
    }
  }

  return undefined;
}
