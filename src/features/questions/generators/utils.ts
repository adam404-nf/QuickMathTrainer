import {
  costAboveBucket,
  matchesMentalCostBucket,
} from "../mentalCost";
import { filterTemplates } from "../templates";
import type { QuestionTemplate } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import { chooseQuestionKind, pickOne } from "../utils";
import { appendCostStep, MAX_APPEND_STEPS } from "./appendStep";

const MAX_TEMPLATE_ATTEMPTS = 60;
/** 同一 template 內以不同（較簡單）數字重抽的次數，用來把過高的 cost 降回範圍。 */
const REROLLS_PER_TEMPLATE = 4;

export function tryExtendQuestion(
  question: Question,
  input: GenerateQuestionInput,
  extend: (question: Question) => Question | undefined = appendCostStep,
): Question {
  if (!input.targetMentalCostBucket) {
    return question;
  }

  let current = question;
  let appendCount = 0;

  while (
    !matchesMentalCostBucket(current.mentalCost, input.targetMentalCostBucket) &&
    appendCount < MAX_APPEND_STEPS
  ) {
    if (costAboveBucket(current.mentalCost, input.targetMentalCostBucket)) {
      return current;
    }

    const extended = extend(current);
    if (!extended || extended.mentalCost <= current.mentalCost) {
      break;
    }
    current = extended;
    appendCount += 1;
  }

  return current;
}

export function generateFromTemplates(
  templates: readonly QuestionTemplate[],
  input: GenerateQuestionInput,
): Question | undefined {
  const filtered = filterTemplates(templates, input.targetTags);

  if (input.targetTags && input.targetTags.length > 0 && filtered.length === 0) {
    return undefined;
  }

  const pool = filtered.length > 0 ? filtered : templates;
  const bucket = input.targetMentalCostBucket;

  for (let attempt = 0; attempt < MAX_TEMPLATE_ATTEMPTS; attempt += 1) {
    const template = pickOne(pool);

    // 保留 template 結構，重抽較簡單／不同的數字，嘗試讓 cost 落回目標範圍，
    // 而非放寬 difficulty range。
    for (let reroll = 0; reroll < REROLLS_PER_TEMPLATE; reroll += 1) {
      let question = template({
        difficulty: input.difficulty,
        kind: chooseQuestionKind(),
      });

      question = tryExtendQuestion(question, input);

      if (!bucket || matchesMentalCostBucket(question.mentalCost, bucket)) {
        return question;
      }

      // cost 太高 → 重抽較簡單數字；cost 太低且無法追加 → 換數字再試。
      if (!costAboveBucket(question.mentalCost, bucket)) {
        // 低於範圍：同一 template 再抽通常無法拉高，直接換 template。
        break;
      }
    }
  }

  return undefined;
}
