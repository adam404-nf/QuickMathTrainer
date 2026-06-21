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

export function generateQuestion(input: GenerateQuestionInput): Question {
  const eligibleTypes =
    input.mode === "mixed" ? availableQuestionTypes : availableQuestionTypes.filter((type) => type === input.mode);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const type = pickOne(eligibleTypes);
    const candidate = generatorByType[type](input);

    if (candidate && isQuestionValid(candidate, input.difficulty, input.context.seenQuestionIds)) {
      return candidate;
    }
  }

  // If the session exhausts unique candidates, keep the flow moving by allowing older questions again.
  const fallbackType = pickOne(eligibleTypes);
  const fallback = generatorByType[fallbackType](input);

  if (!fallback) {
    throw new Error("No question generator returned a question.");
  }

  return fallback;
}
