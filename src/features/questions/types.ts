export type Difficulty = "easy" | "medium" | "hard";

export type QuestionKind = "fill-in" | "multiple-choice";

export type QuestionType = "arithmetic" | "fractions" | "powers";

export type PracticeMode = "mixed" | "weakness-focused" | QuestionType;

export type MentalCost = 1 | 2 | 3 | 4 | 5;

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
  strategy: string;
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
}

export type QuestionGenerator = (
  input: GenerateQuestionInput,
) => Question | undefined;
