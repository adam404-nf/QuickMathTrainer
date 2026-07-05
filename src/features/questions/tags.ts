import type { QuestionType } from "./types";

/** Fine-grained skill tags used for weakness diagnosis. */
export const SKILL_TAGS = [
  "addition",
  "subtraction",
  "multiplication",
  "division",
  "order-of-operations",
  "working-memory",
  "fractions",
  "decimals",
  "square-root",
  "cube-root",
  "fourth-root",
  "absolute-value",
  "symbolic-simplification",
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

export const SKILL_TAG_LABELS: Record<SkillTag, string> = {
  addition: "加法",
  subtraction: "減法",
  multiplication: "乘法",
  division: "除法",
  "order-of-operations": "運算次序",
  "working-memory": "中間結果記憶",
  fractions: "分數",
  decimals: "小數",
  "square-root": "平方根",
  "cube-root": "三次方根",
  "fourth-root": "四次方根",
  "absolute-value": "絕對值",
  "symbolic-simplification": "符號化簡",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  arithmetic: "整數四則",
  fractions: "分數小數",
  powers: "冪次根號",
};

export function isSkillTag(value: string): value is SkillTag {
  return (SKILL_TAGS as readonly string[]).includes(value);
}

export function getSkillTagLabel(tag: string): string {
  if (isSkillTag(tag)) {
    return SKILL_TAG_LABELS[tag];
  }

  return tag;
}

export function getQuestionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPE_LABELS[type];
}
