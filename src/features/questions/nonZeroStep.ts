import { resultForTemplate, type CalculationTemplateSpec } from "./calculationTemplates";
import { ZERO_STEP_ACCEPT_RATE } from "./selectionPolicy";
import { parseNumericAnswer } from "./utils";

const ZERO_EPS = 1e-9;

export function isZeroStepResult(result: string): boolean {
  if (!result || result === "") return false;
  const n = parseNumericAnswer(result);
  return n !== undefined && Math.abs(n) < ZERO_EPS;
}

function isNearZero(value: number): boolean {
  return Math.abs(value) < ZERO_EPS;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < ZERO_EPS;
}

/** 加減乘步驟的運算元為 0（cost 已是 0）→ 平凡／無效應。除法除數為 0 不在此處理。 */
export function hasZeroOperand(spec: CalculationTemplateSpec): boolean {
  switch (spec.kind) {
    case "integer-add":
    case "integer-subtract":
    case "integer-multiply":
      return isNearZero(spec.a) || isNearZero(spec.b);
    case "decimal-add":
      return isNearZero(spec.left) || isNearZero(spec.right);
    case "decimal-subtract":
      return isNearZero(spec.whole) || isNearZero(spec.fraction);
    case "decimal-multiply":
      return isNearZero(spec.decimal) || isNearZero(spec.integer);
    case "decimal-fraction-add":
    case "decimal-fraction-subtract":
    case "decimal-fraction-multiply":
      return isNearZero(spec.decimal) || isNearZero(spec.fraction.num);
    default:
      return false;
  }
}

type BinaryEffect =
  | { family: "addsub"; delta: number }
  | { family: "muldiv"; factor: number }
  | undefined;

function stepEffect(spec: CalculationTemplateSpec): BinaryEffect {
  switch (spec.kind) {
    case "integer-add":
      return { family: "addsub", delta: spec.b };
    case "integer-subtract":
      return { family: "addsub", delta: -spec.b };
    case "integer-multiply":
      return { family: "muldiv", factor: spec.b };
    case "integer-divide":
      return { family: "muldiv", factor: 1 / spec.divisor };
    case "decimal-add":
      return { family: "addsub", delta: spec.right };
    case "decimal-subtract":
      return { family: "addsub", delta: -spec.fraction };
    case "decimal-multiply":
      return { family: "muldiv", factor: spec.integer };
    case "decimal-fraction-add":
      return { family: "addsub", delta: spec.fraction.num / spec.fraction.den };
    case "decimal-fraction-subtract":
      return { family: "addsub", delta: -(spec.fraction.num / spec.fraction.den) };
    case "decimal-fraction-multiply":
      return { family: "muldiv", factor: spec.fraction.num / spec.fraction.den };
    case "decimal-fraction-divide":
      return { family: "muldiv", factor: spec.fraction.den / spec.fraction.num };
    case "fraction-unlike-denom": {
      const op = spec.op ?? "+";
      const value = spec.right.num / spec.right.den;
      return { family: "addsub", delta: op === "−" ? -value : value };
    }
    case "fraction-multiply":
      return { family: "muldiv", factor: spec.right.num / spec.right.den };
    case "fraction-divide":
      return { family: "muldiv", factor: spec.right.den / spec.right.num };
    default:
      return undefined;
  }
}

/** 相鄰兩步互逆抵消：+x 再 −x、×x 再 ÷x（及反向）。 */
export function hasAdjacentCancel(specs: readonly CalculationTemplateSpec[]): boolean {
  for (let i = 0; i < specs.length - 1; i += 1) {
    const prev = stepEffect(specs[i]);
    const next = stepEffect(specs[i + 1]);
    if (!prev || !next || prev.family !== next.family) {
      continue;
    }
    if (prev.family === "addsub" && nearlyEqual(prev.delta + next.delta, 0)) {
      return true;
    }
    if (
      prev.family === "muldiv" &&
      prev.factor !== 0 &&
      next.factor !== 0 &&
      nearlyEqual(prev.factor * next.factor, 1)
    ) {
      return true;
    }
  }
  return false;
}

const EVEN_POWER_KINDS = new Set<CalculationTemplateSpec["kind"]>([
  "square",
  "fourth-power",
  "decimal-square",
]);

/** 同題同時出現絕對值與偶次方（平方／四次方）→ 絕對值多餘。 */
export function hasAbsEvenPowerConflict(specs: readonly CalculationTemplateSpec[]): boolean {
  let hasAbs = false;
  let hasEvenPower = false;
  for (const spec of specs) {
    if (spec.kind === "absolute-value") {
      hasAbs = true;
    }
    if (EVEN_POWER_KINDS.has(spec.kind)) {
      hasEvenPower = true;
    }
  }
  return hasAbs && hasEvenPower;
}

/**
 * 「避免零／平凡抵消」總檢查：步驟結果為 0、零運算元、相鄰互逆、絕對值+偶次方。
 * 與既有 decideZeroStep 的 98%/2% 政策搭配使用。
 */
export function hasTrivialCancelViolation(specs: readonly CalculationTemplateSpec[]): boolean {
  if (specs.some((spec) => isZeroStepResult(resultForTemplate(spec)))) {
    return true;
  }
  if (specs.some((spec) => hasZeroOperand(spec))) {
    return true;
  }
  if (hasAdjacentCancel(specs)) {
    return true;
  }
  if (hasAbsEvenPowerConflict(specs)) {
    return true;
  }
  return false;
}

export type ZeroStepDecision = "accept" | "reroll-numbers" | "reject-template";

export function decideZeroStep(params: {
  isZero: boolean;
  numberRerollCount: number;
  maxNumberRerolls: number;
  random?: () => number;
}): ZeroStepDecision {
  if (!params.isZero) {
    return "accept";
  }
  if (params.numberRerollCount < params.maxNumberRerolls) {
    return "reroll-numbers";
  }
  const roll = (params.random ?? Math.random)();
  return roll < ZERO_STEP_ACCEPT_RATE ? "accept" : "reject-template";
}
