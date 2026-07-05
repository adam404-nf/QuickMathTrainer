import { describe, expect, it } from "vitest";
import {
  baseCostForTemplate,
  calculateMentalCost,
  describeMentalCost,
  type CalculationTemplateSpec,
} from "./calculationTemplates";
import { generateQuestion } from "./registry";
import type { MentalCost } from "./types";

function assertMentalCost(
  label: string,
  templates: readonly CalculationTemplateSpec[],
  expected: MentalCost,
): void {
  const detail = describeMentalCost(templates);
  if (detail.mentalCost !== expected) {
    const breakdown = detail.templates
      .map((spec, index) => `${spec.kind}=${detail.baseCosts[index]}`)
      .join(", ");
    throw new Error(
      `${label}: expected mentalCost ${expected}, got ${detail.mentalCost} ` +
        `(templates: [${breakdown}], workingMemory=${detail.workingMemoryCost})`,
    );
  }
}

function mc(...templates: CalculationTemplateSpec[]): MentalCost {
  return calculateMentalCost(templates);
}

describe("calculation template baseCost", () => {
  const cases: Array<{ label: string; spec: CalculationTemplateSpec; expected: number }> = [
    { label: "整數加法 12+15", spec: { kind: "integer-add", a: 12, b: 15 }, expected: 1 },
    { label: "整數加法 47+68", spec: { kind: "integer-add", a: 47, b: 68 }, expected: 2 },
    { label: "整數加法 47+28（單次進位）", spec: { kind: "integer-add", a: 47, b: 28 }, expected: 1 },
    { label: "整數減法 23-12", spec: { kind: "integer-subtract", a: 23, b: 12 }, expected: 1 },
    { label: "整數減法 47-28（單次借位）", spec: { kind: "integer-subtract", a: 47, b: 28 }, expected: 1 },
    { label: "整數減法 150-87（兩次借位）", spec: { kind: "integer-subtract", a: 150, b: 87 }, expected: 2 },
    { label: "整數乘法 6×7", spec: { kind: "integer-multiply", a: 6, b: 7 }, expected: 1 },
    { label: "整數乘法 14×6", spec: { kind: "integer-multiply", a: 14, b: 6 }, expected: 2 },
    { label: "整數乘法 19×7", spec: { kind: "integer-multiply", a: 19, b: 7 }, expected: 2 },
    { label: "整數乘法 18×12", spec: { kind: "integer-multiply", a: 18, b: 12 }, expected: 3 },
    { label: "整數乘法 42×18", spec: { kind: "integer-multiply", a: 42, b: 18 }, expected: 4 },
    { label: "整數除法 16÷4", spec: { kind: "integer-divide", dividend: 16, divisor: 4 }, expected: 1 },
    { label: "整數除法 84÷12", spec: { kind: "integer-divide", dividend: 84, divisor: 12 }, expected: 2 },
    { label: "整數除法 168÷12", spec: { kind: "integer-divide", dividend: 168, divisor: 12 }, expected: 3 },
    { label: "整數除法 720÷36", spec: { kind: "integer-divide", dividend: 720, divisor: 36 }, expected: 4 },
    { label: "絕對值 |-8|", spec: { kind: "absolute-value" }, expected: 1 },
    { label: "平方 6²", spec: { kind: "square", n: 6 }, expected: 1 },
    { label: "平方 19²", spec: { kind: "square", n: 19 }, expected: 2 },
    { label: "平方根 √196", spec: { kind: "square-root", radicand: 196 }, expected: 2 },
    { label: "立方 5³", spec: { kind: "cube", n: 5 }, expected: 2 },
    { label: "四次方 4⁴", spec: { kind: "fourth-power", n: 4 }, expected: 3 },
    { label: "三次方根 ∛64", spec: { kind: "cube-root", root: 4 }, expected: 2 },
    { label: "四次方根 ⁴√16", spec: { kind: "fourth-root", root: 2 }, expected: 2 },
    { label: "符號化簡 √(x²)", spec: { kind: "symbolic-simplify" }, expected: 4 },
    { label: "同分母 1/4+2/4", spec: { kind: "fraction-same-denom", denominator: 4 }, expected: 1 },
    {
      label: "異分母 1/2+1/3 (LCM=6)",
      spec: { kind: "fraction-unlike-denom", left: { num: 1, den: 2 }, right: { num: 1, den: 3 } },
      expected: 3,
    },
    {
      label: "異分母高 LCM (61–84)",
      spec: { kind: "fraction-unlike-denom", left: { num: 1, den: 7 }, right: { num: 1, den: 12 } },
      expected: 5,
    },
    {
      label: "分數乘法 2/3×5/7",
      spec: { kind: "fraction-multiply", left: { num: 2, den: 3 }, right: { num: 5, den: 7 } },
      expected: 3,
    },
    {
      label: "分數除法 3/4÷2/5",
      spec: { kind: "fraction-divide", left: { num: 3, den: 4 }, right: { num: 2, den: 5 } },
      expected: 4,
    },
    { label: "分數轉小數 1/4", spec: { kind: "fraction-to-decimal", denominator: 4 }, expected: 1 },
    { label: "小數加法 0.3+0.4", spec: { kind: "decimal-add", left: 0.3, right: 0.4 }, expected: 1 },
    { label: "小數減法 5-0.3", spec: { kind: "decimal-subtract", whole: 5, fraction: 0.3 }, expected: 2 },
    { label: "小數乘整數 0.4×6", spec: { kind: "decimal-multiply", decimal: 0.4, integer: 6 }, expected: 2 },
  ];

  it.each(cases)("$label → baseCost $expected", ({ spec, expected }) => {
    expect(baseCostForTemplate(spec)).toBe(expected);
  });
});

describe("question template mentalCost (32 templates)", () => {
  const arithmeticCases: Array<{ label: string; templates: CalculationTemplateSpec[]; expected: MentalCost }> = [
    { label: "base × partner (14×6)", templates: [{ kind: "integer-multiply", a: 14, b: 6 }], expected: 2 },
    { label: "left + right (12+15)", templates: [{ kind: "integer-add", a: 12, b: 15 }], expected: 1 },
    {
      label: "dividend ÷ divisor (84÷12)",
      templates: [{ kind: "integer-divide", dividend: 84, divisor: 12 }],
      expected: 2,
    },
    {
      label: "(a+b)×c (2×(12+15))",
      templates: [
        { kind: "integer-add", a: 12, b: 15 },
        { kind: "integer-multiply", a: 2, b: 27 },
      ],
      expected: 4,
    },
    {
      label: "(a×b)+c ((14×6)+8)",
      templates: [
        { kind: "integer-multiply", a: 14, b: 6 },
        { kind: "integer-add", a: 84, b: 8 },
      ],
      expected: 4,
    },
    {
      label: "a²-b² (23²-17²)",
      templates: [
        { kind: "square", n: 23 },
        { kind: "square", n: 17 },
        { kind: "integer-subtract", a: 529, b: 289 },
      ],
      expected: 8,
    },
    {
      label: "(a+b)(a-b) ((25+15)(25-15))",
      templates: [
        { kind: "integer-add", a: 25, b: 15 },
        { kind: "integer-subtract", a: 25, b: 15 },
        { kind: "integer-multiply", a: 40, b: 10 },
      ],
      expected: 8,
    },
    {
      label: "|a|+b×c (|-8|+3×7)",
      templates: [
        { kind: "absolute-value" },
        { kind: "integer-multiply", a: 3, b: 7 },
        { kind: "integer-add", a: 8, b: 21 },
      ],
      expected: 5,
    },
    {
      label: "|a|-|b| (|-8|-|-3|)",
      templates: [
        { kind: "absolute-value" },
        { kind: "absolute-value" },
        { kind: "integer-subtract", a: 8, b: 3 },
      ],
      expected: 5,
    },
  ];

  const powersCases: Array<{ label: string; templates: CalculationTemplateSpec[]; expected: MentalCost }> = [
    { label: "value² (12²)", templates: [{ kind: "square", n: 12 }], expected: 1 },
    { label: "√radicand (√196)", templates: [{ kind: "square-root", radicand: 196 }], expected: 2 },
    { label: "base³ (5³)", templates: [{ kind: "cube", n: 5 }], expected: 2 },
    { label: "base⁴ (4⁴)", templates: [{ kind: "fourth-power", n: 4 }], expected: 3 },
    { label: "∛radicand (∛64)", templates: [{ kind: "cube-root", root: 4 }], expected: 2 },
    { label: "⁴√radicand (⁴√16)", templates: [{ kind: "fourth-root", root: 2 }], expected: 2 },
    {
      label: "√((signed)²) (√((-7)²))",
      templates: [{ kind: "square-root", radicand: 49 }, { kind: "absolute-value" }],
      expected: 3,
    },
    { label: "√(variable²)", templates: [{ kind: "symbolic-simplify" }], expected: 4 },
    {
      label: "|a|² (|-7|²)",
      templates: [{ kind: "absolute-value" }, { kind: "square", n: 7 }],
      expected: 3,
    },
    {
      label: "|a|+b (|-5|+3)",
      templates: [{ kind: "absolute-value" }, { kind: "integer-add", a: 5, b: 3 }],
      expected: 3,
    },
  ];

  const fractionCases: Array<{ label: string; templates: CalculationTemplateSpec[]; expected: MentalCost }> = [
    {
      label: "同分母加法 (1/4+2/4)",
      templates: [{ kind: "fraction-same-denom", denominator: 4 }],
      expected: 1,
    },
    {
      label: "異分母加法 (1/2+1/3)",
      templates: [{ kind: "fraction-unlike-denom", left: { num: 1, den: 2 }, right: { num: 1, den: 3 } }],
      expected: 3,
    },
    {
      label: "異分母減法 (5/6-1/4)",
      templates: [{ kind: "fraction-unlike-denom", left: { num: 5, den: 6 }, right: { num: 1, den: 4 } }],
      expected: 3,
    },
    {
      label: "分數乘法 (2/3×5/7)",
      templates: [{ kind: "fraction-multiply", left: { num: 2, den: 3 }, right: { num: 5, den: 7 } }],
      expected: 3,
    },
    {
      label: "分數除法 (3/4÷2/5)",
      templates: [{ kind: "fraction-divide", left: { num: 3, den: 4 }, right: { num: 2, den: 5 } }],
      expected: 4,
    },
    {
      label: "2 步分數複合 ((1/2+1/3)×2/5)",
      templates: [
        { kind: "fraction-unlike-denom", left: { num: 1, den: 2 }, right: { num: 1, den: 3 } },
        { kind: "fraction-multiply", left: { num: 5, den: 6 }, right: { num: 2, den: 5 } },
      ],
      expected: 6,
    },
    {
      label: "3 步分數複合",
      templates: [
        { kind: "fraction-unlike-denom", left: { num: 1, den: 2 }, right: { num: 1, den: 3 } },
        { kind: "fraction-multiply", left: { num: 5, den: 6 }, right: { num: 2, den: 5 } },
        { kind: "fraction-unlike-denom", left: { num: 1, den: 3 }, right: { num: 1, den: 6 } },
      ],
      expected: 10,
    },
    {
      label: "|a/b-c/d| (|1/2-1/3|)",
      templates: [
        { kind: "fraction-unlike-denom", left: { num: 1, den: 2 }, right: { num: 1, den: 3 } },
        { kind: "absolute-value" },
      ],
      expected: 5,
    },
    {
      label: "|a/b-c/d|±e/f (|2/3-1/4|+1/6)",
      templates: [
        { kind: "fraction-unlike-denom", left: { num: 2, den: 3 }, right: { num: 1, den: 4 } },
        { kind: "absolute-value" },
        { kind: "fraction-unlike-denom", left: { num: 5, den: 12 }, right: { num: 1, den: 6 } },
      ],
      expected: 9,
    },
    { label: "分數轉小數 (1/4)", templates: [{ kind: "fraction-to-decimal", denominator: 4 }], expected: 1 },
    { label: "小數加法 (0.3+0.4)", templates: [{ kind: "decimal-add", left: 0.3, right: 0.4 }], expected: 1 },
    {
      label: "小數乘整數 (0.4×6)",
      templates: [{ kind: "decimal-multiply", decimal: 0.4, integer: 6 }],
      expected: 2,
    },
    {
      label: "小數減法 (5-0.3)",
      templates: [{ kind: "decimal-subtract", whole: 5, fraction: 0.3 }],
      expected: 2,
    },
  ];

  it.each(arithmeticCases)("[arithmetic] $label → $expected", ({ label, templates, expected }) => {
    assertMentalCost(label, templates, expected);
  });

  it.each(powersCases)("[powers] $label → $expected", ({ label, templates, expected }) => {
    assertMentalCost(label, templates, expected);
  });

  it.each(fractionCases)("[fractions] $label → $expected", ({ label, templates, expected }) => {
    assertMentalCost(label, templates, expected);
  });
});

describe("intrinsic mentalCost invariance", () => {
  it("keeps 12+15 at cost 1 regardless of difficulty context", () => {
    const templates = [{ kind: "integer-add" as const, a: 12, b: 15 }];
    expect(mc(...templates)).toBe(1);
    expect(mc(...templates)).toBe(1);
    expect(mc(...templates)).toBe(1);
  });

  it("keeps 47+68 at cost 2 regardless of difficulty context", () => {
    expect(mc({ kind: "integer-add", a: 47, b: 68 })).toBe(2);
  });
});

describe("difficulty weighted mentalCost distribution", () => {
  function sampleDistribution(difficulty: "easy" | "medium" | "hard", count: number): Record<number, number> {
    const counts: Record<number, number> = {};
    for (let index = 0; index < count; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty,
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      counts[question.mentalCost] = (counts[question.mentalCost] ?? 0) + 1;
    }
    return counts;
  }

  function ratio(counts: Record<number, number>, costs: number[], total: number): number {
    const matched = costs.reduce((sum, cost) => sum + (counts[cost] ?? 0), 0);
    return matched / total;
  }

  it("easy mode concentrates on cost 5–6 with 3 and 7 tails", () => {
    const total = 300;
    const counts = sampleDistribution("easy", total);
    expect(ratio(counts, [5, 6], total)).toBeGreaterThan(0.55);
    expect(ratio(counts, [3], total)).toBeGreaterThan(0.04);
    expect(ratio(counts, [7], total)).toBeGreaterThan(0.1);
  });

  it("medium mode concentrates on cost 8–9", () => {
    const total = 300;
    const counts = sampleDistribution("medium", total);
    expect(ratio(counts, [8, 9], total)).toBeGreaterThan(0.6);
    expect(ratio(counts, [7], total)).toBeGreaterThan(0.05);
    expect(ratio(counts, [10], total)).toBeGreaterThan(0.04);
  });

  it("hard mode concentrates on cost 10–11", () => {
    const total = 300;
    const counts = sampleDistribution("hard", total);
    expect(ratio(counts, [10, 11], total)).toBeGreaterThan(0.65);
    expect(ratio(counts, [9], total)).toBeGreaterThan(0.1);
  });
});
