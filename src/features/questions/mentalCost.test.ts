import { describe, expect, it } from "vitest";
import {
  calculateCost,
  calculateQuestionCost,
  CHUNK_CONSTANTS,
  fractionCost,
  fractionToDecimalInternalCost,
  integerCost,
  integerDivideInternalCost,
  isTwoDigitMultiply,
  lcmTierMultiplier,
  MULTI_STEP_COORDINATION_COST,
  TWO_DIGIT_MULTIPLY_BONUS,
  type CostNode,
} from "./costModel";
import {
  calculateMentalCost,
  costForTemplateSpec,
  describeMentalCost,
  mcNodes,
  memoryCostForAnswer,
} from "./calculationTemplates";
import {
  classifyCostBand,
  costRangeForDifficulty,
  DIFFICULTY_COST_DISTRIBUTIONS,
  matchesMentalCostBucket,
  sampleCostDistributionBand,
} from "./mentalCost";
import { generateQuestion } from "./registry";
import type { Difficulty, Question } from "./types";

describe("atomic integer operations", () => {
  it.each([
    { label: "3+4", op: "add" as const, a: 3, b: 4, expected: 1 },
    { label: "7-5", op: "subtract" as const, a: 7, b: 5, expected: 1 },
    { label: "3×4", op: "multiply" as const, a: 3, b: 4, expected: 1 },
    { label: "8÷2", op: "divide" as const, a: 8, b: 2, expected: 1 },
  ])("$label → cost $expected", ({ op, a, b, expected }) => {
    expect(integerCost(op, a, b)).toBe(expected);
  });

  it.each([
    { label: "a+0", node: { kind: "integer", operation: "add", a: 5, b: 0 } as CostNode },
    { label: "a×1", node: { kind: "integer", operation: "multiply", a: 5, b: 1 } as CostNode },
    { label: "a÷1", node: { kind: "integer", operation: "divide", a: 8, b: 1 } as CostNode },
  ])("$label is free", ({ node }) => {
    expect(calculateCost(node)).toBe(0);
  });

  it("25+36 includes carry cost", () => {
    expect(integerCost("add", 25, 36)).toBe(3);
  });

  it("34-19 includes borrow cost", () => {
    expect(integerCost("subtract", 34, 19)).toBe(3);
  });

  it("long integer addition scales with digits", () => {
    const cost = integerCost("add", 5_432_167_890, 4_567_890_123);
    expect(cost).toBeGreaterThanOrEqual(10);
    expect(cost).toBeLessThanOrEqual(22);
  });
});

describe("fraction chunk calibration", () => {
  it("applies lcm tier multipliers", () => {
    expect(lcmTierMultiplier(6)).toBe(0.4);
    expect(lcmTierMultiplier(84)).toBe(0.75);
    expect(lcmTierMultiplier(4200)).toBe(1.15);
  });

  it("detects two-digit multiplication bonus operands", () => {
    expect(isTwoDigitMultiply(23, 75)).toBe(true);
    expect(isTwoDigitMultiply(3, 75)).toBe(false);
  });

  it("1/2+1/3 stays in easy range", () => {
    const cost = fractionCost("add", { num: 1, den: 2 }, { num: 1, den: 3 });
    expect(cost).toBeGreaterThanOrEqual(1.5);
    expect(cost).toBeLessThanOrEqual(8);
  });

  it("23/56+31/75 reflects large LCM and two-digit expansion", () => {
    const fraction = fractionCost("add", { num: 23, den: 56 }, { num: 31, den: 75 });
    const simple = fractionCost("add", { num: 1, den: 2 }, { num: 1, den: 3 });
    expect(fraction).toBeGreaterThan(simple * 2);
    expect(fraction).toBeGreaterThanOrEqual(8);
    expect(fraction).toBeLessThanOrEqual(22);
  });

  it("uses configured chunk constants", () => {
    expect(CHUNK_CONSTANTS.fractionAdd).toBe(0.9);
    expect(TWO_DIGIT_MULTIPLY_BONUS).toBe(1.25);
  });
});

describe("fraction-to-decimal long division cost", () => {
  it("costs more than 1 because long division needs zero padding", () => {
    // 舊版 1/11 會被當成「除數 > 被除數」而回傳 1，明顯低估。
    expect(fractionToDecimalInternalCost(1, 11)).toBeGreaterThan(1);
  });

  it("uses the enlarged dividend (100 ÷ 11) plus the padding steps", () => {
    // 1/11 需補兩個零 → 實際是 100 ÷ 11 的長除法。
    expect(fractionToDecimalInternalCost(1, 11)).toBe(integerDivideInternalCost(100, 11) + 2);
  });

  it("repeating fractions cost more than quick terminating ones", () => {
    expect(fractionToDecimalInternalCost(1, 11)).toBeGreaterThan(fractionToDecimalInternalCost(1, 2));
  });

  it("flows through the fraction-to-decimal-explicit template cost", () => {
    expect(costForTemplateSpec({ kind: "fraction-to-decimal-explicit", numerator: 1, denominator: 11 })).toBe(
      fractionToDecimalInternalCost(1, 11),
    );
  });
});

describe("cost breakdown expressions", () => {
  it("lists each numeric step with its actual expression and cost", () => {
    const description = describeMentalCost(
      [
        { kind: "integer-add", a: 1, b: 2 },
        { kind: "integer-multiply", a: 3, b: 4 },
      ],
      "12",
    );

    expect(description.steps.map((step) => step.expression)).toEqual(["1 + 2 = 3", "3 × 4 = 12"]);
    for (const step of description.steps) {
      expect(step.effectiveCost).toBeGreaterThan(0);
    }
  });

  it("keeps per-step costs consistent with the total mental cost", () => {
    const templates = [
      { kind: "fraction-to-decimal-explicit", numerator: 1, denominator: 8 },
      { kind: "decimal-add", left: 0.125, right: 0.5 },
    ] as const;
    const description = describeMentalCost(templates, "0.625");
    expect(description.stepsCost + description.coordinationOverhead + description.memoryCost).toBeCloseTo(
      description.mentalCost,
    );
    expect(description.mentalCost).toBeCloseTo(calculateMentalCost(templates, "0.625"));
  });
});

describe("question cost aggregation", () => {
  it("sums chunk costs with multi-step coordination overhead", () => {
    const nodes = [
      { kind: "integer", operation: "add", a: 12, b: 15 },
      { kind: "integer", operation: "multiply", a: 2, b: 27 },
    ] as const;
    const cost = mcNodes(...nodes);
    expect(cost).toBe(
      integerCost("add", 12, 15) + integerCost("multiply", 2, 27) + MULTI_STEP_COORDINATION_COST,
    );
  });

  it("keeps intrinsic cost for repeated evaluation", () => {
    const nodes: CostNode[] = [{ kind: "integer", operation: "add", a: 25, b: 36 }];
    expect(calculateQuestionCost(nodes)).toBe(3);
    expect(calculateQuestionCost(nodes)).toBe(3);
  });

  it.each([
    { answer: "7", expected: 0.1 },
    { answer: "42", expected: 0.3 },
    { answer: "350", expected: 0.8 },
    { answer: "1234", expected: 1 },
    { answer: "-42", expected: 0.3 },
    { answer: "3/4", expected: 1 },
    { answer: "5/6", expected: 1 },
    { answer: "0.5", expected: 0.1 },
    { answer: "1.25", expected: 0.8 },
    { answer: "0.125", expected: 0.8 },
    { answer: "|x|", expected: 0.1 },
  ])("assigns memory cost for $answer", ({ answer, expected }) => {
    expect(memoryCostForAnswer(answer)).toBe(expected);
  });

  it("adds memory cost to the total mental cost", () => {
    expect(
      calculateMentalCost([{ kind: "integer-add", a: 25, b: 36 }], "61"),
    ).toBe(3.3);
  });
});

describe("global difficulty cost ranges", () => {
  function sampleQuestions(
    mode: "mixed" | "arithmetic" | "fractions" | "powers",
    difficulty: Difficulty,
    count: number,
  ): Question[] {
    const questions: Question[] = [];
    for (let index = 0; index < count; index += 1) {
      questions.push(
        generateQuestion({
          mode,
          difficulty,
          context: { recentQuestionIds: [], seenQuestionIds: new Set() },
        }),
      );
    }
    return questions;
  }

  it("uses the same range for every question type", () => {
    for (const difficulty of ["easy", "medium", "hard", "extreme"] as const) {
      const range = costRangeForDifficulty(difficulty);
      expect(costRangeForDifficulty(difficulty)).toEqual(range);
    }
    expect(costRangeForDifficulty("easy")).toEqual({ type: "range", min: 8, max: 12 });
    expect(costRangeForDifficulty("medium")).toEqual({ type: "range", min: 10, max: 15 });
    expect(costRangeForDifficulty("hard")).toEqual({ type: "range", min: 13, max: 18 });
    expect(costRangeForDifficulty("extreme")).toEqual({ type: "range", min: 17, max: 28 });
  });

  it("defines weighted bands for every difficulty", () => {
    expect(DIFFICULTY_COST_DISTRIBUTIONS.easy).toEqual([
      { min: 8, max: 9, weight: 0.3 },
      { min: 9, max: 10, weight: 0.5 },
      { min: 10, max: 11.5, weight: 0.15 },
      { min: 11.5, max: 12, weight: 0.05, inclusiveMax: true },
    ]);
    expect(DIFFICULTY_COST_DISTRIBUTIONS.medium).toEqual([
      { min: 10, max: 12, weight: 0.3 },
      { min: 12, max: 14, weight: 0.5 },
      { min: 14, max: 15, weight: 0.2, inclusiveMax: true },
    ]);
    expect(DIFFICULTY_COST_DISTRIBUTIONS.hard).toEqual([
      { min: 13, max: 15, weight: 0.2 },
      { min: 15, max: 17, weight: 0.6 },
      { min: 17, max: 18, weight: 0.2, inclusiveMax: true },
    ]);
    expect(DIFFICULTY_COST_DISTRIBUTIONS.extreme).toEqual([
      { min: 17, max: 20, weight: 0.15 },
      { min: 20, max: 23, weight: 0.15 },
      { min: 23, max: 25, weight: 0.4 },
      { min: 25, max: 28, weight: 0.4, inclusiveMax: true },
    ]);
  });

  it("classifies costs into weighted bands with the last band including max", () => {
    expect(classifyCostBand("easy", 8)).toBe(0);
    expect(classifyCostBand("easy", 9)).toBe(1);
    expect(classifyCostBand("easy", 11.5)).toBe(3);
    expect(classifyCostBand("easy", 12)).toBe(3);
    expect(classifyCostBand("extreme", 28)).toBe(3);
  });

  it("samples only bands that stay within the overall range", () => {
    for (const difficulty of ["easy", "medium", "hard", "extreme"] as const) {
      const overall = costRangeForDifficulty(difficulty);
      for (let index = 0; index < 50; index += 1) {
        const band = sampleCostDistributionBand(difficulty);
        expect(band.min).toBeGreaterThanOrEqual(overall.min);
        expect(band.max).toBeLessThanOrEqual(overall.max);
      }
    }
  });

  it.each(["easy", "medium", "hard", "extreme"] as const)(
    "mixed %s questions all fall in the global range",
    (difficulty) => {
      const range = costRangeForDifficulty(difficulty);
      const questions = sampleQuestions("mixed", difficulty, 40);
      for (const question of questions) {
        expect(matchesMentalCostBucket(question.mentalCost, range)).toBe(true);
      }
    },
    60_000,
  );

  it("matches bucket helper uses raw ranges", () => {
    expect(matchesMentalCostBucket(8, { type: "range", min: 6, max: 10 })).toBe(true);
    expect(matchesMentalCostBucket(11, { type: "range", min: 6, max: 10 })).toBe(false);
  });
});

describe("legacy template adapter", () => {
  it("maps integer templates through cost model", () => {
    expect(
      calculateMentalCost([{ kind: "integer-add", a: 25, b: 36 }], "61"),
    ).toBe(3.3);
  });
});
