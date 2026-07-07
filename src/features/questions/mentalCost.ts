import type { Difficulty } from "./types";

export const LCM_HARD_CAP = 100;

export type MentalCostBucket = { type: "range"; min: number; max: number };
export type CostDistributionBand = {
  min: number;
  max: number;
  weight: number;
  inclusiveMax?: boolean;
};

/**
 * 全題型共用同一套 difficulty cost range。
 *
 * 各題型之間的難度差異已由 Chunk constant（見 costModel.ts）校準到同一條
 * mental-cost 尺度，因此難度範圍不需再依題型分開，否則會雙重計算題型難度。
 */
export const DIFFICULTY_COST_RANGES: Record<Difficulty, MentalCostBucket> = {
  easy: { type: "range", min: 8, max: 12 },
  medium: { type: "range", min: 10, max: 15 },
  hard: { type: "range", min: 13, max: 18 },
  extreme: { type: "range", min: 17, max: 28 },
};

export const DIFFICULTY_COST_DISTRIBUTIONS: Record<Difficulty, CostDistributionBand[]> = {
  easy: [
    { min: 8, max: 9, weight: 0.3 },
    { min: 9, max: 10, weight: 0.5 },
    { min: 10, max: 11.5, weight: 0.15 },
    { min: 11.5, max: 12, weight: 0.05, inclusiveMax: true },
  ],
  medium: [
    { min: 10, max: 12, weight: 0.3 },
    { min: 12, max: 14, weight: 0.5 },
    { min: 14, max: 15, weight: 0.2, inclusiveMax: true },
  ],
  hard: [
    { min: 13, max: 15, weight: 0.2 },
    { min: 15, max: 17, weight: 0.6 },
    { min: 17, max: 18, weight: 0.2, inclusiveMax: true },
  ],
  extreme: [
    { min: 17, max: 20, weight: 0.15 },
    { min: 20, max: 23, weight: 0.15 },
    { min: 23, max: 25, weight: 0.4 },
    { min: 25, max: 28, weight: 0.4, inclusiveMax: true },
  ],
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

export function matchesCostDistributionBand(cost: number, band: CostDistributionBand): boolean {
  return band.inclusiveMax ? cost >= band.min && cost <= band.max : cost >= band.min && cost < band.max;
}

export function classifyCostBand(difficulty: Difficulty, cost: number): number {
  const bands = DIFFICULTY_COST_DISTRIBUTIONS[difficulty];
  return bands.findIndex((band) => matchesCostDistributionBand(cost, band));
}

export function sampleCostDistributionBand(difficulty: Difficulty): MentalCostBucket {
  const bands = DIFFICULTY_COST_DISTRIBUTIONS[difficulty];
  const totalWeight = bands.reduce((sum, band) => sum + band.weight, 0);
  let target = Math.random() * totalWeight;

  for (const band of bands) {
    target -= band.weight;
    if (target <= 0) {
      return { type: "range", min: band.min, max: band.max };
    }
  }

  const fallback = bands[bands.length - 1];
  return { type: "range", min: fallback.min, max: fallback.max };
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
