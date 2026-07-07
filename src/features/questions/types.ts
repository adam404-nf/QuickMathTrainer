import type { MentalCostBucket } from "./mentalCost";
import type { CalculationTemplateSpec } from "./calculationTemplates";

export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export type QuestionKind = "fill-in" | "multiple-choice";

export type QuestionType = "arithmetic" | "fractions" | "powers";

export type PracticeMode = "mixed" | "weakness-focused" | QuestionType;

export type MentalCost = number;

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
  /** 計算此題 mentalCost 所用的各步 spec，用於 cost 檢查面板顯示計算過程。 */
  costTemplates?: CalculationTemplateSpec[];
  technique: QuestionTechnique;
}

export interface QuestionContext {
  recentQuestionIds: string[];
  seenQuestionIds: Set<string>;
  /** 本次練習中各題型已出題數，用於題型數量上限。 */
  typeCounts?: Partial<Record<QuestionType, number>>;
  /** 本次練習總題數，用於計算每題型上限。 */
  questionLimit?: number;
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
