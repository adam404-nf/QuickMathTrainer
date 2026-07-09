import { resolveAnswerPath } from "../answerPath";
import {
  costAboveBucket,
  costBelowBucket,
  costRangeForDifficulty,
  matchesMentalCostBucket,
} from "../mentalCost";
import { filterTemplates } from "../templates";
import type { QuestionTemplateDescriptor } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";
import { appendCostStep, MAX_APPEND_STEPS } from "./appendStep";

const MAX_TEMPLATE_ATTEMPTS = 60;
/** 同一 template 內以不同（較簡單）數字重抽的次數，用來把過高的 cost 降回範圍。 */
const REROLLS_PER_TEMPLATE = 8;

export function tryExtendQuestion(
  question: Question,
  input: GenerateQuestionInput,
  extend: (question: Question) => Question | undefined = (q) => appendCostStep(q, input),
): Question {
  if (!input.targetMentalCostBucket) {
    return question;
  }

  let current = question;
  let appendCount = 0;

  while (
    costBelowBucket(current.mentalCost, input.targetMentalCostBucket) &&
    appendCount < MAX_APPEND_STEPS
  ) {
    const extended = extend(current);
    if (!extended || extended.mentalCost <= current.mentalCost) {
      break;
    }
    current = extended;
    appendCount += 1;
  }

  return current;
}

function finalizeQuestion(question: Question, input: GenerateQuestionInput): Question | undefined {
  const globalRange = costRangeForDifficulty(input.difficulty);
  const checkRange = input.targetMentalCostBucket ?? globalRange;

  const resolved = question.needsAnswerPath ? resolveAnswerPath(question, checkRange) : question;
  if (!resolved) {
    return undefined;
  }

  if (!matchesMentalCostBucket(resolved.mentalCost, checkRange)) {
    return undefined;
  }

  return resolved;
}

export function generateFromTemplates(
  templates: readonly QuestionTemplateDescriptor[],
  input: GenerateQuestionInput,
): Question | undefined {
  const useSpecialtyTags = input.mode === "weakness-focused";
  const filtered = filterTemplates(templates, input.targetTags, { useSpecialtyTags });

  if (input.targetTags && input.targetTags.length > 0 && filtered.length === 0) {
    return undefined;
  }

  const pool = filtered.length > 0 ? filtered : templates;
  const bucket = input.targetMentalCostBucket;

  for (let attempt = 0; attempt < MAX_TEMPLATE_ATTEMPTS; attempt += 1) {
    const template = pickOne(pool);

    for (let reroll = 0; reroll < REROLLS_PER_TEMPLATE; reroll += 1) {
      let question = template.generate({
        difficulty: input.difficulty,
        kind: chooseQuestionKind(),
      });

      question = tryExtendQuestion(question, input);

      const finalized = finalizeQuestion(question, input);
      if (!finalized) {
        if (bucket && costAboveBucket(question.mentalCost, bucket)) {
          continue;
        }
        break;
      }

      if (!bucket || matchesMentalCostBucket(finalized.mentalCost, bucket)) {
        return finalized;
      }

      if (costAboveBucket(finalized.mentalCost, bucket)) {
        continue;
      }

      break;
    }
  }

  return undefined;
}
