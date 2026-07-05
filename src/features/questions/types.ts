import type { MentalCostBucket } from "./mentalCost";

export type Difficulty = "easy" | "medium" | "hard";

export type QuestionKind = "fill-in" | "multiple-choice";

export type QuestionType = "arithmetic" | "fractions" | "powers";

export type PracticeMode = "mixed" | "weakness-focused" | QuestionType;

export type MentalCost = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface QuestionTechnique {
  name: string;
  steps: readonly string[];
}

export interface Question {
  id: string;
  kind: QuestionKind;
  type: QuestionType;
  prompt: string;
  answer: string;
  options?: string[];
  difficulty: Difficulty;
  tags: string[];
  mentalCost: MentalCost;
  technique: QuestionTechnique;
}

export interface QuestionContext {
  recentQuestionIds: string[];
  seenQuestionIds: Set<string>;
}

export interface GenerateQuestionInput {
  mode: PracticeMode;
  difficulty: Difficulty;
  context: QuestionContext;
  targetTags?: string[];
  targetTypes?: QuestionType[];
  selectedQuestionTypes?: QuestionType[];
  targetMentalCostBucket?: MentalCostBucket;
}

export type QuestionGenerator = (
  input: GenerateQuestionInput,
) => Question | undefined;
