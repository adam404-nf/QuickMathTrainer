import {
  calculateCost,
  calculateQuestionCost,
  describeCost,
  type CostNode,
  type FractionOperation,
  type IntegerOperation,
} from "./costModel";
import type { Fraction } from "./fractionMath";
import { lcm } from "./fractionMath";
import type { MentalCost } from "./types";
import { countSignificantDigits, normalizeAnswer } from "./utils";

export type CalculationTemplateKind =
  | "integer-add"
  | "integer-subtract"
  | "integer-multiply"
  | "integer-divide"
  | "absolute-value"
  | "square"
  | "square-root"
  | "cube"
  | "fourth-power"
  | "cube-root"
  | "fourth-root"
  | "symbolic-simplify"
  | "fraction-same-denom"
  | "fraction-unlike-denom"
  | "fraction-multiply"
  | "fraction-divide"
  | "fraction-to-decimal"
  | "decimal-add"
  | "decimal-subtract"
  | "decimal-multiply";

export type CalculationTemplateSpec =
  | { kind: "integer-add"; a: number; b: number }
  | { kind: "integer-subtract"; a: number; b: number }
  | { kind: "integer-multiply"; a: number; b: number }
  | { kind: "integer-divide"; dividend: number; divisor: number }
  | { kind: "absolute-value" }
  | { kind: "square"; n: number }
  | { kind: "square-root"; radicand: number }
  | { kind: "cube"; n: number }
  | { kind: "fourth-power"; n: number }
  | { kind: "cube-root"; root: number }
  | { kind: "fourth-root"; root: number }
  | { kind: "symbolic-simplify"; nested?: boolean }
  | { kind: "fraction-same-denom"; denominator: number; needsReduce?: boolean }
  | { kind: "fraction-unlike-denom"; left: Fraction; right: Fraction }
  | { kind: "fraction-multiply"; left: Fraction; right: Fraction }
  | { kind: "fraction-divide"; left: Fraction; right: Fraction }
  | { kind: "fraction-to-decimal"; denominator: number }
  | { kind: "decimal-add"; left: number; right: number }
  | { kind: "decimal-subtract"; whole: number; fraction: number }
  | { kind: "decimal-multiply"; decimal: number; integer: number };

export function costNodeFromCalculationTemplate(spec: CalculationTemplateSpec): CostNode {
  switch (spec.kind) {
    case "integer-add":
      return { kind: "integer", operation: "add", a: spec.a, b: spec.b };
    case "integer-subtract":
      return { kind: "integer", operation: "subtract", a: spec.a, b: spec.b };
    case "integer-multiply":
      return { kind: "integer", operation: "multiply", a: spec.a, b: spec.b };
    case "integer-divide":
      return { kind: "integer", operation: "divide", a: spec.dividend, b: spec.divisor };
    case "absolute-value":
      return { kind: "absolute-value" };
    case "square":
      return { kind: "power", n: spec.n, exponent: 2 };
    case "square-root":
      return { kind: "root", radicand: spec.radicand, degree: 2 };
    case "cube":
      return { kind: "power", n: spec.n, exponent: 3 };
    case "fourth-power":
      return { kind: "power", n: spec.n, exponent: 4 };
    case "cube-root":
      return { kind: "root", radicand: spec.root ** 3, degree: 3 };
    case "fourth-root":
      return { kind: "root", radicand: spec.root ** 4, degree: 4 };
    case "symbolic-simplify":
      return { kind: "symbolic-simplify" };
    case "fraction-same-denom":
      return {
        kind: "fraction",
        operation: "add",
        left: { num: 1, den: spec.denominator },
        right: { num: 1, den: spec.denominator },
      };
    case "fraction-unlike-denom":
      return { kind: "fraction", operation: "add", left: spec.left, right: spec.right };
    case "fraction-multiply":
      return { kind: "fraction", operation: "multiply", left: spec.left, right: spec.right };
    case "fraction-divide":
      return { kind: "fraction", operation: "divide", left: spec.left, right: spec.right };
    case "fraction-to-decimal":
      return { kind: "integer", operation: "divide", a: 1, b: spec.denominator };
    case "decimal-add":
      return { kind: "integer", operation: "add", a: Math.round(spec.left * 10), b: Math.round(spec.right * 10) };
    case "decimal-subtract":
      return {
        kind: "integer",
        operation: "subtract",
        a: Math.round(spec.whole * 10),
        b: Math.round(spec.fraction * 10),
      };
    case "decimal-multiply":
      return {
        kind: "integer",
        operation: "multiply",
        a: Math.round(spec.decimal * 10),
        b: spec.integer,
      };
    default:
      return { kind: "integer", operation: "add", a: 1, b: 1 };
  }
}

export function costNodesFromTemplates(templates: readonly CalculationTemplateSpec[]): CostNode[] {
  return templates.map(costNodeFromCalculationTemplate);
}

export function baseCostForTemplate(spec: CalculationTemplateSpec): number {
  return calculateCost(costNodeFromCalculationTemplate(spec));
}

export function unlikeDenomBaseCost(left: Fraction, right: Fraction): number {
  if (lcm(left.den, right.den) > 100) {
    return 0;
  }
  return baseCostForTemplate({ kind: "fraction-unlike-denom", left, right });
}

function memoryCostForDigitCount(digits: number): number {
  if (digits <= 1) return 0.1;
  if (digits === 2) return 0.3;
  if (digits === 3) return 0.8;
  return 1;
}

export function memoryCostForAnswer(answer: string): number {
  const normalized = normalizeAnswer(answer);

  if (/^\|[a-z]\|$/.test(normalized)) {
    return 0.1;
  }

  if (/^-?\d+\/-?\d+$/.test(normalized)) {
    return 1;
  }

  if (/^-?\d+$/.test(normalized)) {
    const value = Math.abs(Number(normalized));
    const digits = value === 0 ? 1 : Math.floor(Math.log10(value)) + 1;
    return memoryCostForDigitCount(digits);
  }

  if (/^-?(?:\d+\.\d+|\d+\.|\.\d+)$/.test(normalized)) {
    return memoryCostForDigitCount(countSignificantDigits(normalized));
  }

  return 0;
}

export function calculateMentalCost(
  templates: readonly CalculationTemplateSpec[],
  answer = "",
): MentalCost {
  return calculateQuestionCost(costNodesFromTemplates(templates)) + memoryCostForAnswer(answer);
}

export interface CostStepDescription {
  label: string;
  internalCost: number;
  effectiveCost: number;
}

export interface MentalCostDescription {
  templates: readonly CalculationTemplateSpec[];
  steps: CostStepDescription[];
  /** 各步 effective cost 之和（不含多步驟協調成本）。 */
  stepsCost: number;
  /** 多步驟協調成本：max(0, stepCount - 1) × MULTI_STEP_COORDINATION_COST。 */
  coordinationOverhead: number;
  memoryCost: number;
  mentalCost: MentalCost;
}

export function describeMentalCost(
  templates: readonly CalculationTemplateSpec[],
  answer = "",
): MentalCostDescription {
  const nodes = costNodesFromTemplates(templates);
  const steps: CostStepDescription[] = nodes.map((node) => {
    const { effectiveCost, breakdown } = describeCost(node);
    const first = breakdown[0];
    return {
      label: first?.label ?? node.kind,
      internalCost: first?.internalCost ?? effectiveCost,
      effectiveCost,
    };
  });

  const memoryCost = memoryCostForAnswer(answer);
  const mentalCost = calculateQuestionCost(nodes) + memoryCost;
  const stepsCost = steps.reduce((sum, step) => sum + step.effectiveCost, 0);

  return {
    templates,
    steps,
    stepsCost,
    coordinationOverhead: mentalCost - stepsCost - memoryCost,
    memoryCost,
    mentalCost,
  };
}

export function mcInteger(operation: IntegerOperation, a: number, b: number): MentalCost {
  return calculateCost({ kind: "integer", operation, a, b });
}

export function mcFraction(operation: FractionOperation, left: Fraction, right: Fraction): MentalCost {
  return calculateCost({ kind: "fraction", operation, left, right });
}

export function mcNodes(...nodes: CostNode[]): MentalCost {
  return calculateQuestionCost(nodes);
}

// Legacy exports kept for tests that import specific helpers
export {
  integerAddInternalCost as integerAddBaseCost,
  integerSubtractInternalCost as integerSubtractBaseCost,
} from "./costModel";

export function integerMultiplyBaseCost(a: number, b: number): number {
  return calculateCost({ kind: "integer", operation: "multiply", a, b });
}

export function integerDivideBaseCost(dividend: number, divisor: number): number {
  return calculateCost({ kind: "integer", operation: "divide", a: dividend, b: divisor });
}

export function squareBaseCost(n: number): number {
  return calculateCost({ kind: "power", n, exponent: 2 });
}

export function squareRootBaseCost(radicand: number): number {
  return calculateCost({ kind: "root", radicand, degree: 2 });
}

export function cubeBaseCost(n: number): number {
  return calculateCost({ kind: "power", n, exponent: 3 });
}

export function fourthPowerBaseCost(n: number): number {
  return calculateCost({ kind: "power", n, exponent: 4 });
}

export function cubeRootBaseCost(root: number): number {
  return calculateCost({ kind: "root", radicand: root ** 3, degree: 3 });
}

export function fourthRootBaseCost(root: number): number {
  return calculateCost({ kind: "root", radicand: root ** 4, degree: 4 });
}

export function fractionSameDenomBaseCost(denominator: number, needsReduce = false): number {
  return baseCostForTemplate({ kind: "fraction-same-denom", denominator, needsReduce });
}

export function fractionMultiplyBaseCost(left: Fraction, right: Fraction): number {
  return baseCostForTemplate({ kind: "fraction-multiply", left, right });
}

export function fractionDivideBaseCost(left: Fraction, right: Fraction): number {
  return baseCostForTemplate({ kind: "fraction-divide", left, right });
}

export function fractionToDecimalBaseCost(denominator: number): number {
  return baseCostForTemplate({ kind: "fraction-to-decimal", denominator });
}

export function decimalAddBaseCost(left: number, right: number): number {
  return baseCostForTemplate({ kind: "decimal-add", left, right });
}

export function decimalSubtractBaseCost(whole: number, fraction: number): number {
  return baseCostForTemplate({ kind: "decimal-subtract", whole, fraction });
}

export function decimalMultiplyBaseCost(decimal: number, integer: number): number {
  return baseCostForTemplate({ kind: "decimal-multiply", decimal, integer });
}

export function workingMemoryCost(answer: string): number {
  return memoryCostForAnswer(answer);
}

export function clampMentalCost(value: number): MentalCost {
  return value;
}
