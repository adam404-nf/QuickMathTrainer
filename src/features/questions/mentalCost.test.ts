import { describe, expect, it } from "vitest";
import {
  calculateCost,
  calculateQuestionCost,
  CHUNK_CONSTANTS,
  fractionCost,
  integerCost,
  isTwoDigitMultiply,
  lcmTierMultiplier,
  MULTI_STEP_COORDINATION_COST,
  TWO_DIGIT_MULTIPLY_BONUS,
  type CostNode,
} from "./costModel";
import { calculateMentalCost, mcNodes } from "./calculationTemplates";
import { costRangeForDifficulty, matchesMentalCostBucket } from "./mentalCost";
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
    expect(cost).toBeLessThanOrEqual(6);
  });

  it("23/56+31/75 reflects large LCM and two-digit expansion", () => {
    const fraction = fractionCost("add", { num: 23, den: 56 }, { num: 31, den: 75 });
    const simple = fractionCost("add", { num: 1, den: 2 }, { num: 1, den: 3 });
    expect(fraction).toBeGreaterThan(simple * 2);
    expect(fraction).toBeGreaterThanOrEqual(8);
    expect(fraction).toBeLessThanOrEqual(22);
  });

  it("uses configured chunk constants", () => {
    expect(CHUNK_CONSTANTS.fractionAdd).toBe(0.7);
    expect(TWO_DIGIT_MULTIPLY_BONUS).toBe(1.25);
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
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const range = costRangeForDifficulty(difficulty);
      expect(costRangeForDifficulty(difficulty)).toEqual(range);
    }
    expect(costRangeForDifficulty("easy")).toEqual({ type: "range", min: 8, max: 15 });
    expect(costRangeForDifficulty("medium")).toEqual({ type: "range", min: 12, max: 20 });
    expect(costRangeForDifficulty("hard")).toEqual({ type: "range", min: 15, max: 30 });
  });

  it.each(["easy", "medium", "hard"] as const)(
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
      calculateMentalCost([{ kind: "integer-add", a: 25, b: 36 }]),
    ).toBe(3);
  });
});
