import { filterTemplates } from "../templates";
import type { QuestionTemplate } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";

export function generateFromTemplates(
  templates: readonly QuestionTemplate[],
  input: GenerateQuestionInput,
): Question | undefined {
  const filtered = filterTemplates(templates, input.targetTags);

  if (input.targetTags && input.targetTags.length > 0 && filtered.length === 0) {
    return undefined;
  }

  const pool = filtered.length > 0 ? filtered : templates;
  const template = pickOne(pool);

  return template({
    difficulty: input.difficulty,
    kind: chooseQuestionKind(),
  });
}
