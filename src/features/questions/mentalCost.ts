import type { Difficulty, MentalCost } from "./types";

export const LCM_HARD_CAP = 100;

export type MentalCostBucket =
  | { type: "exact"; cost: MentalCost }
  | { type: "range"; min: MentalCost; max: MentalCost };

type WeightedBucket = {
  weight: number;
  bucket: MentalCostBucket;
};

const easyDistribution: readonly WeightedBucket[] = [
  { weight: 10, bucket: { type: "exact", cost: 3 } },
  { weight: 35, bucket: { type: "exact", cost: 5 } },
  { weight: 35, bucket: { type: "exact", cost: 6 } },
  { weight: 20, bucket: { type: "exact", cost: 7 } },
];

const mediumDistribution: readonly WeightedBucket[] = [
  { weight: 15, bucket: { type: "exact", cost: 7 } },
  { weight: 40, bucket: { type: "exact", cost: 8 } },
  { weight: 35, bucket: { type: "exact", cost: 9 } },
  { weight: 10, bucket: { type: "exact", cost: 10 } },
];

const hardDistribution: readonly WeightedBucket[] = [
  { weight: 20, bucket: { type: "exact", cost: 9 } },
  { weight: 45, bucket: { type: "exact", cost: 10 } },
  { weight: 35, bucket: { type: "exact", cost: 11 } },
];

export const mentalCostDistributionByDifficulty: Record<Difficulty, readonly WeightedBucket[]> = {
  easy: easyDistribution,
  medium: mediumDistribution,
  hard: hardDistribution,
};

export function matchesMentalCostBucket(cost: MentalCost, bucket: MentalCostBucket): boolean {
  if (bucket.type === "exact") {
    return cost === bucket.cost;
  }
  return cost >= bucket.min && cost <= bucket.max;
}

export function pickTargetMentalCostBucket(difficulty: Difficulty, random = Math.random()): MentalCostBucket {
  const distribution = mentalCostDistributionByDifficulty[difficulty];
  const totalWeight = distribution.reduce((sum, item) => sum + item.weight, 0);
  let threshold = random * totalWeight;

  for (const item of distribution) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.bucket;
    }
  }

  return distribution[distribution.length - 1].bucket;
}

export function fallbackBucketsForDifficulty(difficulty: Difficulty): MentalCostBucket[] {
  const distribution = mentalCostDistributionByDifficulty[difficulty];
  return distribution.map((item) => item.bucket);
}
