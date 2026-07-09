import type { MentalCostBucket } from "./mentalCost";
import type { CalculationTemplateSpec } from "./calculationTemplates";
import type { RelaxableConstraint } from "./selectionPolicy";

export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export type QuestionKind = "fill-in" | "multiple-choice";

export type QuestionType = "arithmetic" | "fractions" | "powers";

export type PracticeMode = "mixed" | "weakness-focused" | QuestionType;

export type MentalCost = number;

export type AnswerFormat = "decimal" | "fraction";

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
  /** 專項訓練篩選用；未指定時由 tags 扣除次要 tag 推導。 */
  specialtyTags?: string[];
  /** 填空／選擇題要求的分數或小數形式；整數題省略。 */
  answerFormat?: AnswerFormat;
  /** 整題生成後經 resolveAnswerPath 定稿有理數答案。 */
  needsAnswerPath?: boolean;
  /** 有理數結果（needsAnswerPath 時由模板提供）。 */
  rationalValue?: number;
  mentalCost: MentalCost;
  /** 計算此題 mentalCost 所用的各步 spec，用於 cost 檢查面板顯示計算過程。 */
  costTemplates?: CalculationTemplateSpec[];
  technique: QuestionTechnique;
  templateId?: string;
  /** 主模板分類；由 QuestionTemplateDescriptor.generate 寫入，供 policy／Monte Carlo 使用 */
  templateCategory?: "integer" | "fraction" | "decimal" | "power" | "conversion" | "mixed-decimal-fraction";
}

export interface QuestionContext {
  recentQuestionIds: string[];
  seenQuestionIds: Set<string>;
  /** 本次練習中各題型已出題數，用於題型數量上限。 */
  typeCounts?: Partial<Record<QuestionType, number>>;
  /** 本次練習總題數，用於計算每題型上限。 */
  questionLimit?: number;
  /** 本次練習已生成主模板總數（供累積小數比例）。 */
  sessionPrimaryCount?: number;
  /** 本次練習主模板為 decimal 的累積數。 */
  sessionDecimalPrimaryCount?: number;
  /** 近期主模板為 decimal 的比例，供 allowsDecimalPick 小數上限約束。 */
  recentDecimalRatio?: number;
}

export interface GenerateQuestionInput {
  mode: PracticeMode;
  difficulty: Difficulty;
  context: QuestionContext;
  targetTags?: string[];
  targetTypes?: QuestionType[];
  selectedQuestionTypes?: QuestionType[];
  targetMentalCostBucket?: MentalCostBucket;
  relaxedConstraints?: Array<RelaxableConstraint>;
}

export type QuestionGenerator = (
  input: GenerateQuestionInput,
) => Question | undefined;
