import { isQuestionValid } from "./constraints";
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
import type { GenerateQuestionInput, Question, QuestionGenerator, QuestionType } from "./types";
import { pickOne } from "./utils";

const generatorByType: Record<QuestionType, QuestionGenerator> = {
  arithmetic: generateArithmeticQuestion,
  fractions: generateFractionQuestion,
  powers: generatePowersQuestion,
};

export const availableQuestionTypes = Object.keys(generatorByType) as QuestionType[];

const MAX_GENERATION_ATTEMPTS = 60;

function questionMatchesTargetTags(question: Question, targetTags?: string[]): boolean {
  if (!targetTags || targetTags.length === 0) {
    return true;
  }

  return question.tags.some((tag) => targetTags.includes(tag));
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

/**
 * 排除已達本次練習數量上限的題型，避免高 cost 題型壟斷整份練習。
 * 若全部題型都達上限（理論上不會發生），回傳原列表以免卡死。
 */
function applyTypeQuota(types: QuestionType[], input: GenerateQuestionInput): QuestionType[] {
  const { typeCounts, questionLimit } = input.context;
  if (!typeCounts || !questionLimit || types.length <= 1) {
    return types;
  }

  const cap = maxQuestionsPerType(questionLimit, types.length);
  const underCap = types.filter((type) => (typeCounts[type] ?? 0) < cap);
  return underCap.length > 0 ? underCap : types;
}

/**
 * 嚴格產生一題：cost 必須落在該難度的全域 range 內，絕不放寬 range。
 */
function tryGenerateQuestion(input: GenerateQuestionInput): Question | undefined {
  const eligibleTypes = applyTypeQuota(getEligibleTypes(input), input);

  if (eligibleTypes.length === 0) {
    return undefined;
  }

  const bucket = costRangeForDifficulty(input.difficulty);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const type = pickOne(eligibleTypes);
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

  if (candidate) {
    return candidate;
  }

  // weakness-focused 只放寬「題型／技巧」限制（改用所有 tag 相容題型或放棄 tag 匹配），
  // 但 cost range 一律維持嚴格，不放寬難度。
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

    const withoutTags = tryGenerateQuestion({ ...input, targetTags: undefined });
    if (withoutTags) {
      return withoutTags;
    }
  }

  throw new Error(
    `No in-range question could be generated for mode=${input.mode}, difficulty=${input.difficulty}.`,
  );
}

export function questionMatchesTargets(question: Question, targetTags?: string[]): boolean {
  return questionMatchesTargetTags(question, targetTags);
}
