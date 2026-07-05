import { isQuestionValid } from "./constraints";
import { generateArithmeticQuestion } from "./generators/arithmetic";
import { generateFractionQuestion } from "./generators/fractions";
import { generatePowersQuestion } from "./generators/powers";
import {
  fallbackBucketsForDifficulty,
  matchesMentalCostBucket,
  pickTargetMentalCostBucket,
  type MentalCostBucket,
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

const MAX_GENERATION_ATTEMPTS = 100;

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

function tryGenerateQuestion(
  input: GenerateQuestionInput,
  buckets: MentalCostBucket[],
  options?: { requireBucketMatch?: boolean },
): Question | undefined {
  const requireBucketMatch = options?.requireBucketMatch ?? true;
  const eligibleTypes = getEligibleTypes(input);

  if (eligibleTypes.length === 0) {
    return undefined;
  }

  for (const bucket of buckets) {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const type = pickOne(eligibleTypes);
      const candidate = generatorByType[type]({
        ...input,
        targetMentalCostBucket: requireBucketMatch ? bucket : undefined,
      });

      if (
        candidate &&
        questionMatchesTargetTags(candidate, input.targetTags) &&
        (!requireBucketMatch || matchesMentalCostBucket(candidate.mentalCost, bucket)) &&
        isQuestionValid(candidate, input.difficulty, input.context.seenQuestionIds)
      ) {
        return candidate;
      }
    }
  }

  return undefined;
}

export function generateQuestion(input: GenerateQuestionInput): Question {
  const primaryBucket = pickTargetMentalCostBucket(input.difficulty);
  const buckets = [primaryBucket, ...fallbackBucketsForDifficulty(input.difficulty).filter((bucket) => bucket !== primaryBucket)];
  const requireBucketMatch = input.mode === "mixed";

  const candidate = tryGenerateQuestion(input, buckets, { requireBucketMatch });

  if (candidate) {
    return candidate;
  }

  if (input.mode === "weakness-focused" && input.targetTags && input.targetTags.length > 0) {
    const tagCompatibleTypes = getQuestionTypesForTags(input.targetTags);

    const tagFirstCandidate = tryGenerateQuestion(input, fallbackBucketsForDifficulty(input.difficulty), {
      requireBucketMatch: false,
    });

    if (tagFirstCandidate) {
      return tagFirstCandidate;
    }

    if (tagCompatibleTypes.length > 0) {
      const relaxedCandidate = tryGenerateQuestion(
        {
          ...input,
          targetTypes: tagCompatibleTypes,
        },
        fallbackBucketsForDifficulty(input.difficulty),
      );

      if (relaxedCandidate) {
        return relaxedCandidate;
      }
    }
  }

  const fallbackType = pickOne(availableQuestionTypes);
  const fallback = generatorByType[fallbackType]({
    ...input,
    mode: "mixed",
    targetTags: undefined,
    targetTypes: undefined,
    targetMentalCostBucket: undefined,
  });

  if (!fallback) {
    throw new Error("No question generator returned a question.");
  }

  return fallback;
}

export function questionMatchesTargets(question: Question, targetTags?: string[]): boolean {
  return questionMatchesTargetTags(question, targetTags);
}
