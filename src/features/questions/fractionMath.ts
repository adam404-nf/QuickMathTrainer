import { unlikeDenomBaseCost, type CalculationTemplateSpec } from "./calculationTemplates";
import { LCM_HARD_CAP } from "./mentalCost";
import type { Difficulty, QuestionTechnique } from "./types";
import { pickOne, randomInt } from "./utils";

export interface Fraction {
  num: number;
  den: number;
}

export type BinaryOp = "+" | "−" | "×" | "÷";

export type ExprNode =
  | { kind: "fraction"; value: Fraction }
  | { kind: "integer"; value: number }
  | { kind: "abs"; inner: ExprNode }
  | { kind: "binary"; op: BinaryOp; left: ExprNode; right: ExprNode };

export interface EvalResult {
  value: Fraction | number;
  lcmUsed: number[];
  steps: string[];
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function simplifyFraction(f: Fraction): Fraction {
  if (f.den === 0) {
    throw new Error("Invalid denominator.");
  }
  const sign = f.den < 0 ? -1 : 1;
  const g = gcd(f.num, f.den);
  return { num: (sign * f.num) / g, den: Math.abs(f.den) / g };
}

export function formatFraction(f: Fraction): string {
  const simplified = simplifyFraction(f);
  if (simplified.den === 1) {
    return String(simplified.num);
  }
  return `${simplified.num}/${simplified.den}`;
}

export function isValidDenominatorPair(a: number, b: number): boolean {
  return lcm(a, b) <= LCM_HARD_CAP;
}

export function randomDenominator(difficulty: Difficulty): number {
  const pool =
    difficulty === "hard" || difficulty === "extreme"
      ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : [2, 3, 4, 5, 6, 8, 10, 12];
  return pickOne(pool);
}

export function randomProperFraction(difficulty: Difficulty): Fraction {
  const den = randomDenominator(difficulty);
  return { num: randomInt(1, den - 1), den };
}

export function randomFractionPair(difficulty: Difficulty): [Fraction, Fraction] | null {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const left = randomProperFraction(difficulty);
    const right = randomProperFraction(difficulty);
    if (isValidDenominatorPair(left.den, right.den)) {
      return [left, right];
    }
  }
  return null;
}

function addFractions(left: Fraction, right: Fraction): EvalResult {
  const common = lcm(left.den, right.den);
  const leftNum = left.num * (common / left.den);
  const rightNum = right.num * (common / right.den);
  const value = simplifyFraction({ num: leftNum + rightNum, den: common });
  return {
    value,
    lcmUsed: left.den === right.den ? [] : [common],
    steps: [
      left.den === right.den
        ? `${formatFraction(left)} + ${formatFraction(right)} = ${formatFraction(value)}`
        : `通分 LCM = ${common}：${formatFraction(left)} + ${formatFraction(right)} = ${leftNum}/${common} + ${rightNum}/${common} = ${formatFraction(value)}`,
    ],
  };
}

function subtractFractions(left: Fraction, right: Fraction): EvalResult {
  const common = lcm(left.den, right.den);
  const leftNum = left.num * (common / left.den);
  const rightNum = right.num * (common / right.den);
  const value = simplifyFraction({ num: leftNum - rightNum, den: common });
  return {
    value,
    lcmUsed: left.den === right.den ? [] : [common],
    steps: [
      left.den === right.den
        ? `${formatFraction(left)} − ${formatFraction(right)} = ${formatFraction(value)}`
        : `通分 LCM = ${common}：${formatFraction(left)} − ${formatFraction(right)} = ${leftNum}/${common} − ${rightNum}/${common} = ${formatFraction(value)}`,
    ],
  };
}

function multiplyFractions(left: Fraction, right: Fraction): EvalResult {
  const value = simplifyFraction({ num: left.num * right.num, den: left.den * right.den });
  return {
    value,
    lcmUsed: [],
    steps: [`${formatFraction(left)} × ${formatFraction(right)} = ${formatFraction(value)}`],
  };
}

function divideFractions(left: Fraction, right: Fraction): EvalResult {
  const value = simplifyFraction({ num: left.num * right.den, den: left.den * right.num });
  return {
    value,
    lcmUsed: [],
    steps: [
      `${formatFraction(left)} ÷ ${formatFraction(right)} = ${formatFraction(left)} × ${formatFraction({ num: right.den, den: right.num })} = ${formatFraction(value)}`,
    ],
  };
}

function evalFractionBinary(op: BinaryOp, left: Fraction, right: Fraction): EvalResult {
  if (op === "+") return addFractions(left, right);
  if (op === "−") return subtractFractions(left, right);
  if (op === "×") return multiplyFractions(left, right);
  return divideFractions(left, right);
}

export function formatExpr(node: ExprNode): string {
  if (node.kind === "fraction") {
    return formatFraction(node.value);
  }
  if (node.kind === "integer") {
    return String(node.value);
  }
  if (node.kind === "abs") {
    return `|${formatExpr(node.inner)}|`;
  }
  const left = node.left.kind === "binary" ? `(${formatExpr(node.left)})` : formatExpr(node.left);
  const right = node.right.kind === "binary" ? `(${formatExpr(node.right)})` : formatExpr(node.right);
  return `${left} ${node.op} ${right}`;
}

export function evaluateExpr(node: ExprNode): EvalResult {
  if (node.kind === "fraction") {
    return { value: simplifyFraction(node.value), lcmUsed: [], steps: [] };
  }
  if (node.kind === "integer") {
    return { value: node.value, lcmUsed: [], steps: [] };
  }
  if (node.kind === "abs") {
    const inner = evaluateExpr(node.inner);
    const innerValue = inner.value;
    if (typeof innerValue === "number") {
      const value = Math.abs(innerValue);
      return {
        value,
        lcmUsed: inner.lcmUsed,
        steps: [...inner.steps, `|${innerValue}| = ${value}`],
      };
    }
    const simplified = simplifyFraction(innerValue);
    const value =
      simplified.num >= 0
        ? simplified
        : simplifyFraction({ num: -simplified.num, den: simplified.den });
    return {
      value,
      lcmUsed: inner.lcmUsed,
      steps: [...inner.steps, `|${formatFraction(simplified)}| = ${formatFraction(value)}`],
    };
  }

  const left = evaluateExpr(node.left);
  const right = evaluateExpr(node.right);
  const leftFraction =
    typeof left.value === "number"
      ? simplifyFraction({ num: left.value, den: 1 })
      : simplifyFraction(left.value);
  const rightFraction =
    typeof right.value === "number"
      ? simplifyFraction({ num: right.value, den: 1 })
      : simplifyFraction(right.value);
  const result = evalFractionBinary(node.op, leftFraction, rightFraction);
  return {
    value: result.value,
    lcmUsed: [...left.lcmUsed, ...right.lcmUsed, ...result.lcmUsed],
    steps: [...left.steps, ...right.steps, ...result.steps],
  };
}

export function effectiveLcm(lcmUsed: readonly number[]): number {
  return lcmUsed.length === 0 ? 0 : Math.max(...lcmUsed);
}

export function answerFromEval(value: Fraction | number): string {
  return typeof value === "number" ? String(value) : formatFraction(value);
}

function fractionFromExprNode(node: ExprNode): Fraction {
  if (node.kind === "fraction") {
    return node.value;
  }
  if (node.kind === "integer") {
    return { num: node.value, den: 1 };
  }
  const evaluated = evaluateExpr(node);
  return typeof evaluated.value === "number"
    ? simplifyFraction({ num: evaluated.value, den: 1 })
    : simplifyFraction(evaluated.value);
}

export function calculationTemplatesForExpr(node: ExprNode): CalculationTemplateSpec[] {
  return costNodesForExpr(node).map(costNodeToCalculationTemplate);
}

export function costNodesForExpr(node: ExprNode): import("./costModel").CostNode[] {
  if (node.kind === "fraction" || node.kind === "integer") {
    return [];
  }

  if (node.kind === "abs") {
    return [...costNodesForExpr(node.inner), { kind: "absolute-value" }];
  }

  const leftFraction = fractionFromExprNode(node.left);
  const rightFraction = fractionFromExprNode(node.right);
  const opMap = { "+": "add", "−": "subtract", "×": "multiply", "÷": "divide" } as const;

  return [
    ...costNodesForExpr(node.left),
    ...costNodesForExpr(node.right),
    {
      kind: "fraction",
      operation: opMap[node.op],
      left: leftFraction,
      right: rightFraction,
    },
  ];
}

function costNodeToCalculationTemplate(node: import("./costModel").CostNode): CalculationTemplateSpec {
  if (node.kind === "absolute-value") {
    return { kind: "absolute-value" };
  }
  if (node.kind === "fraction") {
    if (node.operation === "add" && node.left.den === node.right.den) {
      return { kind: "fraction-same-denom", denominator: node.left.den };
    }
    if (node.operation === "add" || node.operation === "subtract") {
      return { kind: "fraction-unlike-denom", left: node.left, right: node.right };
    }
    if (node.operation === "multiply") {
      return { kind: "fraction-multiply", left: node.left, right: node.right };
    }
    return { kind: "fraction-divide", left: node.left, right: node.right };
  }
  return { kind: "integer-add", a: 0, b: 0 };
}

const FRACTION_OPS: BinaryOp[] = ["+", "−", "×", "÷"];

export function buildFractionComposite(
  difficulty: Difficulty,
  stepCount: 2 | 3,
): {
  prompt: string;
  answer: string;
  technique: QuestionTechnique;
  lcmUsed: number[];
  tags: string[];
  calculationTemplates: CalculationTemplateSpec[];
} | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const fractions = Array.from({ length: stepCount + 1 }, () => randomProperFraction(difficulty));
    let expr: ExprNode;
    let ops: BinaryOp[];

    if (stepCount === 2) {
      ops = [pickOne(FRACTION_OPS)];
      expr = {
        kind: "binary",
        op: ops[0],
        left: { kind: "fraction", value: fractions[0] },
        right: { kind: "fraction", value: fractions[1] },
      };
    } else {
      const multiplyFirst = Math.random() < 0.5;
      if (multiplyFirst) {
        ops = [pickOne(["×", "÷"] as const), pickOne(["+", "−"] as const)];
        expr = {
          kind: "binary",
          op: ops[1],
          left: {
            kind: "binary",
            op: ops[0],
            left: { kind: "fraction", value: fractions[0] },
            right: { kind: "fraction", value: fractions[1] },
          },
          right: { kind: "fraction", value: fractions[2] },
        };
      } else {
        ops = [pickOne(["+", "−"] as const), pickOne(["+", "−"] as const)];
        expr = {
          kind: "binary",
          op: ops[1],
          left: {
            kind: "binary",
            op: ops[0],
            left: { kind: "fraction", value: fractions[0] },
            right: { kind: "fraction", value: fractions[1] },
          },
          right: { kind: "fraction", value: fractions[2] },
        };
      }
    }

    const evaluated = evaluateExpr(expr);
    const answer = answerFromEval(evaluated.value);
    if (answer.includes("/0")) {
      continue;
    }

    if (effectiveLcm(evaluated.lcmUsed) > LCM_HARD_CAP) {
      continue;
    }

    const calculationTemplates = calculationTemplatesForExpr(expr);
    if (calculationTemplates.some((spec) => spec.kind === "fraction-unlike-denom" && unlikeDenomBaseCost(spec.left, spec.right) === 0)) {
      continue;
    }

    const prompt = `${formatExpr(expr)} = ?`;
    const technique: QuestionTechnique = {
      name: "分數複合運算",
      steps:
        evaluated.steps.length > 0
          ? evaluated.steps
          : [`${prompt.replace(" = ?", "")} = ${answer}`],
    };

    const tags = ["fractions", "working-memory", "order-of-operations"];
    if (ops.includes("×") || ops.includes("÷")) tags.push("multiplication");
    if (ops.includes("+")) tags.push("addition");
    if (ops.includes("−")) tags.push("subtraction");
    if (ops.includes("÷")) tags.push("division");

    return { prompt, answer, technique, lcmUsed: evaluated.lcmUsed, tags, calculationTemplates };
  }

  return null;
}

export function buildFractionAbsComposite(
  difficulty: Difficulty,
  withOuterOp: boolean,
): {
  prompt: string;
  answer: string;
  technique: QuestionTechnique;
  lcmUsed: number[];
  tags: string[];
  calculationTemplates: CalculationTemplateSpec[];
} | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pair = randomFractionPair(difficulty);
    if (!pair) continue;
    const [left, right] = pair;
    const inner: ExprNode = {
      kind: "binary",
      op: "−",
      left: { kind: "fraction", value: left },
      right: { kind: "fraction", value: right },
    };
    let expr: ExprNode = { kind: "abs", inner };

    if (withOuterOp) {
      const outer = randomProperFraction(difficulty);
      expr = {
        kind: "binary",
        op: pickOne(["+", "−"] as const),
        left: expr,
        right: { kind: "fraction", value: outer },
      };
    }

    const evaluated = evaluateExpr(expr);
    const answer = answerFromEval(evaluated.value);
    if (effectiveLcm(evaluated.lcmUsed) > LCM_HARD_CAP) {
      continue;
    }

    const calculationTemplates = calculationTemplatesForExpr(expr);
    if (calculationTemplates.some((spec) => spec.kind === "fraction-unlike-denom" && unlikeDenomBaseCost(spec.left, spec.right) === 0)) {
      continue;
    }

    return {
      prompt: `${formatExpr(expr)} = ?`,
      answer,
      technique: {
        name: "絕對值與通分",
        steps: evaluated.steps,
      },
      lcmUsed: evaluated.lcmUsed,
      tags: ["absolute-value", "fractions", "working-memory", "order-of-operations"],
      calculationTemplates,
    };
  }

  return null;
}

export function unlikeDenominatorTechnique(
  left: Fraction,
  right: Fraction,
  op: "+" | "−",
): QuestionTechnique {
  const common = lcm(left.den, right.den);
  const leftNum = left.num * (common / left.den);
  const rightNum = right.num * (common / right.den);
  const result =
    op === "+"
      ? simplifyFraction({ num: leftNum + rightNum, den: common })
      : simplifyFraction({ num: leftNum - rightNum, den: common });
  const opLabel = op === "+" ? "+" : "−";
  return {
    name: "通分",
    steps: [
      `分母 ${left.den} 與 ${right.den} 的最小公倍數是 ${common}`,
      `${formatFraction(left)} = ${leftNum}/${common}，${formatFraction(right)} = ${rightNum}/${common}`,
      `${leftNum}/${common} ${opLabel} ${rightNum}/${common} = ${formatFraction(result)}`,
    ],
  };
}

export function fractionMultiplyTechnique(left: Fraction, right: Fraction): QuestionTechnique {
  const result = simplifyFraction({ num: left.num * right.num, den: left.den * right.den });
  return {
    name: "分數乘法",
    steps: [
      `${formatFraction(left)} × ${formatFraction(right)} = ${left.num * right.num}/${left.den * right.den} = ${formatFraction(result)}`,
    ],
  };
}

export function fractionDivideTechnique(left: Fraction, right: Fraction): QuestionTechnique {
  const reciprocal = simplifyFraction({ num: right.den, den: right.num });
  const result = simplifyFraction({ num: left.num * right.den, den: left.den * right.num });
  return {
    name: "分數除法",
    steps: [
      `${formatFraction(left)} ÷ ${formatFraction(right)} = ${formatFraction(left)} × ${formatFraction(reciprocal)} = ${formatFraction(result)}`,
    ],
  };
}

export function decimalToFractionParts(value: number): Fraction {
  const trimmed = String(Number(value.toFixed(6)));
  if (!trimmed.includes(".")) {
    return { num: Number(trimmed), den: 1 };
  }
  const decimalPlaces = trimmed.split(".")[1]?.length ?? 0;
  const den = 10 ** decimalPlaces;
  const num = Math.round(value * den);
  return simplifyFraction({ num, den });
}

export function rationalToFraction(value: number): Fraction {
  return decimalToFractionParts(value);
}

export function hasTerminatingDecimal(value: number): boolean {
  const { den } = rationalToFraction(value);
  let d = den;
  while (d % 2 === 0) {
    d /= 2;
  }
  while (d % 5 === 0) {
    d /= 5;
  }
  return d === 1;
}

export function isSimplestFractionString(answer: string): boolean {
  const match = answer.trim().replace(/\s+/g, "").match(/^(-?\d+)\/(-?\d+)$/);
  if (!match) {
    return false;
  }
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (den <= 0) {
    return false;
  }
  return gcd(num, den) === 1;
}
