import {
  calculateCost,
  calculateQuestionCost,
  DECIMAL_TO_FRACTION_COST_SCALE,
  FRACTION_TO_DECIMAL_COST_SCALE,
  fractionSimplificationCost,
  fractionToDecimalInternalCost,
  MULTI_STEP_COORDINATION_COST,
  type CostNode,
  type FractionOperation,
  type IntegerOperation,
} from "./costModel";
import type { Fraction } from "./fractionMath";
import { formatFraction, lcm, simplifyFraction } from "./fractionMath";
import type { MentalCost } from "./types";
import { countSignificantDigits, formatDecimal, normalizeAnswer } from "./utils";

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
  | "fraction-to-decimal-explicit"
  | "decimal-to-fraction"
  | "decimal-square"
  | "decimal-fraction-add"
  | "decimal-fraction-subtract"
  | "decimal-fraction-multiply"
  | "decimal-fraction-divide"
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
  | { kind: "fraction-to-decimal-explicit"; numerator: number; denominator: number }
  | { kind: "decimal-to-fraction"; decimal: number; numerator: number; denominator: number }
  | { kind: "decimal-square"; decimal: number }
  | { kind: "decimal-fraction-add"; decimal: number; fraction: Fraction; op: "+" }
  | { kind: "decimal-fraction-subtract"; decimal: number; fraction: Fraction; op: "−" }
  | { kind: "decimal-fraction-multiply"; decimal: number; fraction: Fraction; op: "×" }
  | { kind: "decimal-fraction-divide"; decimal: number; fraction: Fraction; op: "÷" }
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
    case "fraction-to-decimal-explicit":
      return {
        kind: "integer",
        operation: "divide",
        a: spec.numerator,
        b: spec.denominator,
      };
    case "decimal-to-fraction":
      return { kind: "integer", operation: "add", a: spec.numerator, b: spec.denominator };
    case "decimal-square": {
      const parts = String(spec.decimal).split(".");
      const scale = 10 ** (parts[1]?.length ?? 1);
      const n = Math.round(spec.decimal * scale);
      return { kind: "power", n, exponent: 2 };
    }
    case "decimal-fraction-add":
      return { kind: "fraction", operation: "add", left: spec.fraction, right: spec.fraction };
    case "decimal-fraction-subtract":
      return { kind: "fraction", operation: "subtract", left: spec.fraction, right: spec.fraction };
    case "decimal-fraction-multiply":
      return { kind: "fraction", operation: "multiply", left: spec.fraction, right: spec.fraction };
    case "decimal-fraction-divide":
      return { kind: "fraction", operation: "divide", left: spec.fraction, right: spec.fraction };
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

export function costForTemplateSpec(spec: CalculationTemplateSpec): number {
  if (spec.kind === "decimal-to-fraction") {
    return fractionSimplificationCost(spec.numerator, spec.denominator) * DECIMAL_TO_FRACTION_COST_SCALE;
  }
  if (spec.kind === "fraction-to-decimal-explicit") {
    return fractionToDecimalInternalCost(spec.numerator, spec.denominator) * FRACTION_TO_DECIMAL_COST_SCALE;
  }
  if (spec.kind === "fraction-to-decimal") {
    // 舊版 1/den：同樣以補零長除法計算，與 explicit 版保持一致尺度。
    return fractionToDecimalInternalCost(1, spec.denominator) * FRACTION_TO_DECIMAL_COST_SCALE;
  }
  return calculateCost(costNodeFromCalculationTemplate(spec));
}

export function baseCostForTemplate(spec: CalculationTemplateSpec): number {
  return costForTemplateSpec(spec);
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
  const stepsCost = templates.reduce((sum, spec) => sum + costForTemplateSpec(spec), 0);
  const coordination = Math.max(0, templates.length - 1) * MULTI_STEP_COORDINATION_COST;
  return stepsCost + coordination + memoryCostForAnswer(answer);
}

export interface CostStepDescription {
  label: string;
  /** 該步驟以實際數字呈現的算式（含結果），例如 "1 + 2 = 3"。 */
  expression: string;
  internalCost: number;
  effectiveCost: number;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : formatDecimal(value);
}

function fractionOpResult(op: "+" | "−" | "×" | "÷", left: Fraction, right: Fraction): Fraction {
  if (op === "+") {
    return simplifyFraction({ num: left.num * right.den + right.num * left.den, den: left.den * right.den });
  }
  if (op === "−") {
    return simplifyFraction({ num: left.num * right.den - right.num * left.den, den: left.den * right.den });
  }
  if (op === "×") {
    return simplifyFraction({ num: left.num * right.num, den: left.den * right.den });
  }
  return simplifyFraction({ num: left.num * right.den, den: left.den * right.num });
}

/**
 * 產生每一步「以實際數字進行」的算式與分類標籤，供過程顯示使用。
 * 目的是讓 breakdown 直接看到 `1/2 + 1/3 = 5/6` 這類含數字與結果的步驟，
 * 而非僅有抽象的 chunk 名稱。
 */
function describeStep(spec: CalculationTemplateSpec): { label: string; expression: string } {
  switch (spec.kind) {
    case "integer-add":
      return { label: "integer-add", expression: `${spec.a} + ${spec.b} = ${spec.a + spec.b}` };
    case "integer-subtract":
      return { label: "integer-subtract", expression: `${spec.a} − ${spec.b} = ${spec.a - spec.b}` };
    case "integer-multiply":
      return { label: "integer-multiply", expression: `${spec.a} × ${spec.b} = ${spec.a * spec.b}` };
    case "integer-divide":
      return {
        label: "integer-divide",
        expression: `${spec.dividend} ÷ ${spec.divisor} = ${formatNumber(spec.dividend / spec.divisor)}`,
      };
    case "absolute-value":
      return { label: "absolute-value", expression: "|…|" };
    case "square":
      return { label: "power", expression: `${spec.n}² = ${spec.n ** 2}` };
    case "cube":
      return { label: "power", expression: `${spec.n}³ = ${spec.n ** 3}` };
    case "fourth-power":
      return { label: "power", expression: `${spec.n}⁴ = ${spec.n ** 4}` };
    case "square-root":
      return { label: "root", expression: `√${spec.radicand} = ${formatNumber(Math.sqrt(spec.radicand))}` };
    case "cube-root":
      return { label: "root", expression: `³√${spec.root ** 3} = ${spec.root}` };
    case "fourth-root":
      return { label: "root", expression: `⁴√${spec.root ** 4} = ${spec.root}` };
    case "symbolic-simplify":
      return { label: "symbolic-simplify", expression: "符號化簡" };
    case "fraction-same-denom": {
      const f: Fraction = { num: 1, den: spec.denominator };
      return {
        label: "fraction-add",
        expression: `${formatFraction(f)} + ${formatFraction(f)} = ${formatFraction(fractionOpResult("+", f, f))}`,
      };
    }
    case "fraction-unlike-denom":
      return {
        label: "fraction-add",
        expression: `${formatFraction(spec.left)} + ${formatFraction(spec.right)} = ${formatFraction(fractionOpResult("+", spec.left, spec.right))}`,
      };
    case "fraction-multiply":
      return {
        label: "fraction-multiply",
        expression: `${formatFraction(spec.left)} × ${formatFraction(spec.right)} = ${formatFraction(fractionOpResult("×", spec.left, spec.right))}`,
      };
    case "fraction-divide":
      return {
        label: "fraction-divide",
        expression: `${formatFraction(spec.left)} ÷ ${formatFraction(spec.right)} = ${formatFraction(fractionOpResult("÷", spec.left, spec.right))}`,
      };
    case "fraction-to-decimal":
      return {
        label: "fraction-to-decimal",
        expression: `1/${spec.denominator} = ${formatNumber(1 / spec.denominator)}`,
      };
    case "fraction-to-decimal-explicit":
      return {
        label: "fraction-to-decimal",
        expression: `${spec.numerator}/${spec.denominator} = ${formatNumber(spec.numerator / spec.denominator)}`,
      };
    case "decimal-to-fraction":
      return {
        label: "decimal-to-fraction",
        expression: `${formatNumber(spec.decimal)} = ${spec.numerator}/${spec.denominator} = ${formatFraction(simplifyFraction({ num: spec.numerator, den: spec.denominator }))}`,
      };
    case "decimal-square":
      return { label: "power", expression: `${formatNumber(spec.decimal)}² = ${formatNumber(spec.decimal ** 2)}` };
    case "decimal-add":
      return {
        label: "decimal-add",
        expression: `${formatNumber(spec.left)} + ${formatNumber(spec.right)} = ${formatNumber(spec.left + spec.right)}`,
      };
    case "decimal-subtract":
      return {
        label: "decimal-subtract",
        expression: `${formatNumber(spec.whole)} − ${formatNumber(spec.fraction)} = ${formatNumber(spec.whole - spec.fraction)}`,
      };
    case "decimal-multiply":
      return {
        label: "decimal-multiply",
        expression: `${formatNumber(spec.decimal)} × ${spec.integer} = ${formatNumber(spec.decimal * spec.integer)}`,
      };
    case "decimal-fraction-add":
    case "decimal-fraction-subtract":
    case "decimal-fraction-multiply":
    case "decimal-fraction-divide": {
      const opLabel = {
        "decimal-fraction-add": "fraction-add",
        "decimal-fraction-subtract": "fraction-subtract",
        "decimal-fraction-multiply": "fraction-multiply",
        "decimal-fraction-divide": "fraction-divide",
      }[spec.kind];
      const fractionValue = spec.fraction.num / spec.fraction.den;
      const numericResult =
        spec.op === "+"
          ? spec.decimal + fractionValue
          : spec.op === "−"
            ? spec.decimal - fractionValue
            : spec.op === "×"
              ? spec.decimal * fractionValue
              : spec.decimal / fractionValue;
      return {
        label: opLabel,
        expression: `${formatNumber(spec.decimal)} ${spec.op} ${formatFraction(spec.fraction)} = ${formatNumber(numericResult)}`,
      };
    }
    default:
      return { label: "sum", expression: "" };
  }
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
  // 每步 effective cost 直接取自 costForTemplateSpec，確保與實際 mentalCost 同源
  // （含分數↔小數換算的特殊計算），避免過程各步加總對不上總 cost。
  const steps: CostStepDescription[] = templates.map((spec) => {
    const effectiveCost = costForTemplateSpec(spec);
    const { label, expression } = describeStep(spec);
    return { label, expression, internalCost: effectiveCost, effectiveCost };
  });

  const memoryCost = memoryCostForAnswer(answer);
  const stepsCost = steps.reduce((sum, step) => sum + step.effectiveCost, 0);
  const coordinationOverhead = Math.max(0, templates.length - 1) * MULTI_STEP_COORDINATION_COST;
  const mentalCost = stepsCost + coordinationOverhead + memoryCost;

  return {
    templates,
    steps,
    stepsCost,
    coordinationOverhead,
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
