import { isQuestionValid } from "./constraints";
import { generateArithmeticQuestion } from "./generators/arithmetic";
import { generateFractionQuestion } from "./generators/fractions";
import { generatePowersQuestion } from "./generators/powers";
import type { GenerateQuestionInput, Question, QuestionGenerator, QuestionType } from "./types";
import { pickOne } from "./utils";

const generatorByType: Record<QuestionType, QuestionGenerator> = {
  arithmetic: generateArithmeticQuestion,
  fractions: generateFractionQuestion,
  powers: generatePowersQuestion,
};

export const availableQuestionTypes = Object.keys(generatorByType) as QuestionType[];

function questionMatchesTargetTags(question: Question, targetTags?: string[]): boolean {
  if (!targetTags || targetTags.length === 0) {
    return true;
  }

  return question.tags.some((tag) => targetTags.includes(tag));
}

function getEligibleTypes(input: GenerateQuestionInput): QuestionType[] {
  if (input.mode === "weakness-focused" && input.targetTypes && input.targetTypes.length > 0) {
    return input.targetTypes.filter((type) => availableQuestionTypes.includes(type));
  }

  if (input.mode === "mixed" || input.mode === "weakness-focused") {
    return availableQuestionTypes;
  }

  return availableQuestionTypes.filter((type) => type === input.mode);
}

function tryGenerateQuestion(input: GenerateQuestionInput): Question | undefined {
  const eligibleTypes = getEligibleTypes(input);

  if (eligibleTypes.length === 0) {
    return undefined;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const type = pickOne(eligibleTypes);
    const candidate = generatorByType[type](input);

    if (
      candidate &&
      questionMatchesTargetTags(candidate, input.targetTags) &&
      isQuestionValid(candidate, input.difficulty, input.context.seenQuestionIds)
    ) {
      return candidate;
    }
  }

  return undefined;
}

export function generateQuestion(input: GenerateQuestionInput): Question {
  const phases: GenerateQuestionInput[] = [input];

  if (input.mode === "weakness-focused") {
    phases.push({ ...input, targetTags: undefined });

    if (input.targetTypes && input.targetTypes.length > 0) {
      phases.push({ ...input, targetTags: undefined, targetTypes: input.targetTypes });
    }

    phases.push({
      ...input,
      mode: "mixed",
      targetTags: undefined,
      targetTypes: undefined,
    });
  }

  for (const phaseInput of phases) {
    const candidate = tryGenerateQuestion(phaseInput);

    if (candidate) {
      return candidate;
    }
  }

  const fallbackType = pickOne(availableQuestionTypes);
  const fallback = generatorByType[fallbackType]({
    ...input,
    mode: "mixed",
    targetTags: undefined,
    targetTypes: undefined,
  });

  if (!fallback) {
    throw new Error("No question generator returned a question.");
  }

  return fallback;
}

export function questionMatchesTargets(question: Question, targetTags?: string[]): boolean {
  return questionMatchesTargetTags(question, targetTags);
}
