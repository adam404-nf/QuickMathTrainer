import { isQuestionValid } from "./constraints";
import { getEffectiveSpecialtyTags } from "./answerPath";
import { generateArithmeticQuestion } from "./generators/arithmetic";
import { generateFractionQuestion } from "./generators/fractions";
import { generatePowersQuestion } from "./generators/powers";
import {
  classifyCostBand,
  costRangeForDifficulty,
  matchesMentalCostBucket,
  maxQuestionsPerType,
  sampleCostDistributionBand,
} from "./mentalCost";
import { getQuestionTypesForTags } from "./templates";
import {
  questionTypeWeight,
  relaxationOrder,
} from "./selectionPolicy";
import type { GenerateQuestionInput, Question, QuestionGenerator, QuestionType } from "./types";
import { pickWeighted } from "./utils";

const generatorByType: Record<QuestionType, QuestionGenerator> = {
  arithmetic: generateArithmeticQuestion,
  fractions: generateFractionQuestion,
  powers: generatePowersQuestion,
};

export const availableQuestionTypes = Object.keys(generatorByType) as QuestionType[];

const MAX_GENERATION_ATTEMPTS = 60;
const SOFT_QUOTA_PENALTY = 0.15;

function questionMatchesTargetTags(question: Question, targetTags?: string[]): boolean {
  if (!targetTags || targetTags.length === 0) {
    return true;
  }

  const specialtyTags = getEffectiveSpecialtyTags(question);
  return specialtyTags.some((tag) => targetTags.includes(tag));
}

function resolveWeaknessFocusedTypes(input: GenerateQuestionInput): QuestionType[] {
  const requestedTypes =
    input.targetTypes && input.targetTypes.length > 0
      ? input.targetTypes.filter((type) => availableQuestionTypes.includes(type))
      : availableQuestionTypes;

  if (!input.targetTags || input.targetTags.length === 0) {
    return requestedTypes.length > 0 ? requestedTypes : availableQuestionTypes;
  }

  const tagCompatibleTypes = getQuestionTypesForTags(input.targetTags);
  const matchedTypes = requestedTypes.filter((type) => tagCompatibleTypes.includes(type));

  if (matchedTypes.length > 0) {
    return matchedTypes;
  }

  return tagCompatibleTypes.length > 0 ? tagCompatibleTypes : requestedTypes;
}

function getEligibleTypes(input: GenerateQuestionInput): QuestionType[] {
  if (input.mode === "weakness-focused") {
    return resolveWeaknessFocusedTypes(input);
  }

  if (input.mode === "mixed") {
    const selected = input.selectedQuestionTypes?.filter((type) => availableQuestionTypes.includes(type));

    if (selected && selected.length > 0) {
      return selected;
    }

    return availableQuestionTypes;
  }

  return availableQuestionTypes.filter((type) => type === input.mode);
}

function quotaMultiplier(type: QuestionType, input: GenerateQuestionInput, underCap: Set<QuestionType>): number {
  if (!input.context.typeCounts || !input.context.questionLimit) return 1;
  return underCap.has(type) ? 1 : SOFT_QUOTA_PENALTY;
}

/**
 * 嚴格產生一題：cost 必須落在該難度的全域 range 內，絕不放寬 range。
 */
function tryGenerateQuestion(input: GenerateQuestionInput): Question | undefined {
  const baseTypes = getEligibleTypes(input);
  if (baseTypes.length === 0) return undefined;

  const { typeCounts, questionLimit } = input.context;
  const cap =
    typeCounts && questionLimit
      ? maxQuestionsPerType(questionLimit, baseTypes.length)
      : Number.POSITIVE_INFINITY;
  const underCap = new Set(
    baseTypes.filter((type) => (typeCounts?.[type] ?? 0) < cap),
  );

  const bucket = costRangeForDifficulty(input.difficulty);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const type = pickWeighted(baseTypes, (t) => questionTypeWeight(input, t) * quotaMultiplier(t, input, underCap));
    const targetBand = sampleCostDistributionBand(input.difficulty);
    const candidate = generatorByType[type]({
      ...input,
      targetMentalCostBucket: targetBand,
    });

    if (
      candidate &&
      questionMatchesTargetTags(candidate, input.targetTags) &&
      classifyCostBand(input.difficulty, candidate.mentalCost) >= 0 &&
      matchesMentalCostBucket(candidate.mentalCost, bucket) &&
      isQuestionValid(candidate, input.difficulty, input.context.seenQuestionIds)
    ) {
      return candidate;
    }
  }

  return undefined;
}

export function generateQuestion(input: GenerateQuestionInput): Question {
  const candidate = tryGenerateQuestion(input);
  if (candidate) return candidate;

  // 退讓：依序放寬比例約束，寫入 relaxedConstraints；仍不寬鬆 cost
  const order = relaxationOrder();
  for (let i = 0; i < order.length; i += 1) {
    const relaxed = order.slice(0, i + 1);
    const retry = tryGenerateQuestion({ ...input, relaxedConstraints: relaxed });
    if (retry) return retry;
  }

  // 最後 weakness-focused tag 退讓（維持 cost 嚴格）
  if (input.mode === "weakness-focused" && input.targetTags && input.targetTags.length > 0) {
    const tagCompatibleTypes = getQuestionTypesForTags(input.targetTags);

    if (tagCompatibleTypes.length > 0) {
      const relaxedTypes = tryGenerateQuestion({
        ...input,
        targetTypes: tagCompatibleTypes,
      });

      if (relaxedTypes) {
        return relaxedTypes;
      }
    }
  }

  throw new Error(
    `No in-range question could be generated for mode=${input.mode}, difficulty=${input.difficulty}.`,
  );
}

export function questionMatchesTargets(question: Question, targetTags?: string[]): boolean {
  return questionMatchesTargetTags(question, targetTags);
}
