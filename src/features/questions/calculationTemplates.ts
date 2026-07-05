import type { Fraction } from "./fractionMath";
import { lcm as fractionLcm } from "./fractionMath";
import type { MentalCost } from "./types";

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

function hasAdditionCarry(a: number, b: number): boolean {
  return (a % 10) + (b % 10) >= 10;
}

function hasSubtractionBorrow(a: number, b: number): boolean {
  return (a % 10) < (b % 10);
}

export function integerAddBaseCost(a: number, b: number): number {
  const sum = a + b;
  if (a < 40 && b < 40 && !hasAdditionCarry(a, b) && sum < 100) {
    return 1;
  }
  if (sum < 150) {
    return 2;
  }
  return 3;
}

export function integerSubtractBaseCost(a: number, b: number): number {
  if (a < 40 && b < 20 && !hasSubtractionBorrow(a, b)) {
    return 1;
  }
  if (a < 100) {
    return 2;
  }
  return 3;
}

export function integerMultiplyBaseCost(a: number, b: number): number {
  const max = Math.max(Math.abs(a), Math.abs(b));
  const min = Math.min(Math.abs(a), Math.abs(b));
  if (max <= 15 && min <= 9) {
    return 1;
  }
  if (max <= 19 && min <= 9) {
    return 2;
  }
  if (max <= 49 && min <= 19) {
    return 3;
  }
  return 4;
}

export function integerDivideBaseCost(dividend: number, divisor: number): number {
  if (dividend <= 81 && divisor <= 9) {
    return 1;
  }
  if (dividend <= 144 && divisor <= 12) {
    return 2;
  }
  if (divisor <= 12) {
    return 3;
  }
  return 4;
}

export function squareBaseCost(n: number): number {
  if (n <= 12) return 1;
  if (n <= 20) return 2;
  if (n <= 25) return 3;
  return 4;
}

export function squareRootBaseCost(radicand: number): number {
  const root = Math.sqrt(radicand);
  if (root <= 10) return 1;
  if (root <= 16) return 2;
  return 3;
}

export function cubeBaseCost(n: number): number {
  return n <= 5 ? 2 : 3;
}

export function fourthPowerBaseCost(n: number): number {
  return n <= 4 ? 3 : 4;
}

export function cubeRootBaseCost(root: number): number {
  return root <= 4 ? 2 : 3;
}

export function fourthRootBaseCost(root: number): number {
  return root <= 4 ? 2 : 3;
}

export function unlikeDenomBaseCost(left: Fraction, right: Fraction): number {
  const common = fractionLcm(left.den, right.den);
  if (common > 100) {
    return 0;
  }
  if (common <= 12) return 3;
  if (common <= 60) return 4;
  if (common <= 84) return 5;
  return 6;
}

export function fractionSameDenomBaseCost(denominator: number, needsReduce = false): number {
  if (denominator <= 6 && !needsReduce) return 1;
  if (denominator <= 12) return 2;
  return 3;
}

export function fractionMultiplyBaseCost(left: Fraction, right: Fraction): number {
  const productNum = left.num * right.num;
  const productDen = left.den * right.den;
  const canCrossCancel =
    left.num % right.den === 0 ||
    left.den % right.num === 0 ||
    right.num % left.den === 0 ||
    right.den % left.num === 0;
  if (canCrossCancel || (productNum <= 20 && productDen <= 20)) return 2;
  if (productNum <= 50 && productDen <= 50) return 3;
  return 4;
}

export function fractionDivideBaseCost(left: Fraction, right: Fraction): number {
  const canCrossCancel = left.num % right.num === 0 || left.den % right.den === 0;
  if (canCrossCancel) return 3;
  const productNum = left.num * right.den;
  const productDen = left.den * right.num;
  if (productNum <= 30 && productDen <= 30) return 4;
  return 5;
}

export function fractionToDecimalBaseCost(denominator: number): number {
  if ([2, 4, 5, 10].includes(denominator)) return 1;
  if ([8, 20, 25].includes(denominator)) return 2;
  return 3;
}

export function decimalAddBaseCost(left: number, right: number): number {
  const sum = left + right;
  return sum < 1 && Number.isInteger(sum * 10) ? 1 : 2;
}

export function decimalSubtractBaseCost(whole: number, fraction: number): number {
  return fraction < 1 && whole >= 1 ? 2 : 1;
}

export function decimalMultiplyBaseCost(decimal: number, integer: number): number {
  const result = decimal * integer;
  return Number.isInteger(Math.round(result * 10)) ? 2 : 3;
}

export function baseCostForTemplate(spec: CalculationTemplateSpec): number {
  switch (spec.kind) {
    case "integer-add":
      return integerAddBaseCost(spec.a, spec.b);
    case "integer-subtract":
      return integerSubtractBaseCost(spec.a, spec.b);
    case "integer-multiply":
      return integerMultiplyBaseCost(spec.a, spec.b);
    case "integer-divide":
      return integerDivideBaseCost(spec.dividend, spec.divisor);
    case "absolute-value":
      return 1;
    case "square":
      return squareBaseCost(spec.n);
    case "square-root":
      return squareRootBaseCost(spec.radicand);
    case "cube":
      return cubeBaseCost(spec.n);
    case "fourth-power":
      return fourthPowerBaseCost(spec.n);
    case "cube-root":
      return cubeRootBaseCost(spec.root);
    case "fourth-root":
      return fourthRootBaseCost(spec.root);
    case "symbolic-simplify":
      return spec.nested ? 5 : 4;
    case "fraction-same-denom":
      return fractionSameDenomBaseCost(spec.denominator, spec.needsReduce);
    case "fraction-unlike-denom":
      return unlikeDenomBaseCost(spec.left, spec.right);
    case "fraction-multiply":
      return fractionMultiplyBaseCost(spec.left, spec.right);
    case "fraction-divide":
      return fractionDivideBaseCost(spec.left, spec.right);
    case "fraction-to-decimal":
      return fractionToDecimalBaseCost(spec.denominator);
    case "decimal-add":
      return decimalAddBaseCost(spec.left, spec.right);
    case "decimal-subtract":
      return decimalSubtractBaseCost(spec.whole, spec.fraction);
    case "decimal-multiply":
      return decimalMultiplyBaseCost(spec.decimal, spec.integer);
    default:
      return 1;
  }
}

export function workingMemoryCost(templateCount: number): number {
  return Math.max(0, templateCount - 1);
}

export function clampMentalCost(value: number): MentalCost {
  return Math.min(11, Math.max(1, Math.round(value))) as MentalCost;
}

export function calculateMentalCost(templates: readonly CalculationTemplateSpec[]): MentalCost {
  const totalBase = templates.reduce((sum, spec) => sum + baseCostForTemplate(spec), 0);
  return clampMentalCost(totalBase + workingMemoryCost(templates.length));
}

export function describeMentalCost(templates: readonly CalculationTemplateSpec[]): {
  templates: readonly CalculationTemplateSpec[];
  baseCosts: number[];
  workingMemoryCost: number;
  mentalCost: MentalCost;
} {
  const baseCosts = templates.map((spec) => baseCostForTemplate(spec));
  const memory = workingMemoryCost(templates.length);
  return {
    templates,
    baseCosts,
    workingMemoryCost: memory,
    mentalCost: clampMentalCost(baseCosts.reduce((a, b) => a + b, 0) + memory),
  };
}
