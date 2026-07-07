import type { Difficulty } from "./types";

export const LCM_HARD_CAP = 100;

export type MentalCostBucket = { type: "range"; min: number; max: number };

/**
 * 全題型共用同一套 difficulty cost range。
 *
 * 各題型之間的難度差異已由 Chunk constant（見 costModel.ts）校準到同一條
 * mental-cost 尺度，因此難度範圍不需再依題型分開，否則會雙重計算題型難度。
 */
export const DIFFICULTY_COST_RANGES: Record<Difficulty, MentalCostBucket> = {
  easy: { type: "range", min: 8, max: 15 },
  medium: { type: "range", min: 12, max: 20 },
  hard: { type: "range", min: 15, max: 30 },
};

export function costRangeForDifficulty(difficulty: Difficulty): MentalCostBucket {
  return DIFFICULTY_COST_RANGES[difficulty];
}

/**
 * 向下相容的別名：所有題型共用同一範圍，因此忽略 type 參數。
 */
export function costRangeForType(_type: unknown, difficulty: Difficulty): MentalCostBucket {
  return costRangeForDifficulty(difficulty);
}

export function matchesMentalCostBucket(cost: number, bucket: MentalCostBucket): boolean {
  return cost >= bucket.min && cost <= bucket.max;
}

export function costBelowBucket(cost: number, bucket: MentalCostBucket): boolean {
  return cost < bucket.min;
}

export function costAboveBucket(cost: number, bucket: MentalCostBucket): boolean {
  return cost > bucket.max;
}

/**
 * 混合／弱點模式下單一題型的數量上限，避免高 cost 題型（如分數）壟斷整份練習。
 */
export function maxQuestionsPerType(questionLimit: number, eligibleTypeCount: number): number {
  if (eligibleTypeCount <= 1) {
    return questionLimit;
  }
  return Math.ceil(questionLimit / eligibleTypeCount) + 1;
}
