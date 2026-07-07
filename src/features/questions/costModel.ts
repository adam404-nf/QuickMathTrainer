import type { Fraction } from "./fractionMath";
import { gcd as fractionGcd, lcm as fractionLcm } from "./fractionMath";

export type IntegerOperation = "add" | "subtract" | "multiply" | "divide";
export type FractionOperation = "add" | "subtract" | "multiply" | "divide";

export type CostNode =
  | { kind: "integer"; operation: IntegerOperation; a: number; b: number }
  | { kind: "fraction"; operation: FractionOperation; left: Fraction; right: Fraction }
  | { kind: "absolute-value"; inner?: CostNode }
  | { kind: "power"; n: number; exponent: 2 | 3 | 4 }
  | { kind: "root"; radicand: number; degree: 2 | 3 | 4 }
  | { kind: "symbolic-simplify" }
  | { kind: "sum"; nodes: readonly CostNode[] };

export const CHUNK_CONSTANTS = {
  integer: 1.0,
  // 分數相關 chunk 常數整體調高，讓分數運算的整體 cost 更貼近其真實心智負擔
  // （通分、擴分、分子運算、約分等多環節疊加），避免分數題被系統性低估。
  // 主要調大四個分數運算常數，內部子 chunk 只微調以免多層相乘後過度膨脹。
  expandFraction: 0.35,
  gcd: 0.4,
  fractionSimplification: 0.5,
  fractionAdd: 0.9,
  fractionSubtract: 0.9,
  fractionMultiply: 0.7,
  fractionDivide: 0.85,
  absoluteValue: 0.8,
  power: 0.75,
  root: 0.75,
  symbolicSimplify: 0.75,
} as const;

export const TWO_DIGIT_MULTIPLY_BONUS = 1.25;

/** 每多一個計算步驟的協調成本（stepCount - 1 倍）。 */
export const MULTI_STEP_COORDINATION_COST = 1;

/**
 * 分數→小數換算 chunk 乘數（可調常數，用來平衡 cost；目前設為 1）。
 * 分數轉小數以「補零後的被除數 ÷ 分母」的長除法成本計算（見 fractionToDecimalInternalCost）。
 */
export const FRACTION_TO_DECIMAL_COST_SCALE = 1.0;
/**
 * 小數→分數換算 chunk 乘數（可調常數，用來平衡 cost；目前設為 1）。
 * 小數轉分數理解為一次約分（如 0.375 = 375/1000 再約分），cost 參考分數約分計算。
 */
export const DECIMAL_TO_FRACTION_COST_SCALE = 1.0;

export function lcmTierMultiplier(lcmValue: number): number {
  if (lcmValue <= 12) return 0.4;
  if (lcmValue <= 60) return 0.55;
  if (lcmValue <= 120) return 0.75;
  if (lcmValue <= 300) return 0.95;
  return 1.15;
}

export function isTwoDigitMultiply(a: number, b: number): boolean {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  return absA >= 10 && absA <= 99 && absB >= 10 && absB <= 99;
}

function digitsOf(n: number): number[] {
  const value = Math.abs(n);
  if (value === 0) return [0];
  const digits: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    digits.push(remaining % 10);
    remaining = Math.floor(remaining / 10);
  }
  return digits;
}

function isFreeAdd(a: number, b: number): boolean {
  return a === 0 || b === 0;
}

function isFreeSubtract(_a: number, b: number): boolean {
  return b === 0;
}

function isFreeMultiply(a: number, b: number): boolean {
  return a === 0 || b === 0 || a === 1 || b === 1;
}

function isFreeDivide(_dividend: number, b: number): boolean {
  return b === 1;
}

export function integerAddInternalCost(a: number, b: number): number {
  if (isFreeAdd(a, b)) return 0;

  let cost = 0;
  let carry = 0;
  let remainingA = Math.abs(a);
  let remainingB = Math.abs(b);

  while (remainingA > 0 || remainingB > 0 || carry > 0) {
    cost += 1;
    const digitA = remainingA % 10;
    const digitB = remainingB % 10;
    const sum = digitA + digitB + carry;
    if (sum >= 10) {
      cost += 1;
    }
    carry = sum >= 10 ? 1 : 0;
    remainingA = Math.floor(remainingA / 10);
    remainingB = Math.floor(remainingB / 10);
  }

  return cost;
}

export function integerSubtractInternalCost(a: number, b: number): number {
  if (isFreeSubtract(a, b)) return 0;

  let cost = 0;
  let borrow = 0;
  let remainingA = Math.abs(a);
  let remainingB = Math.abs(b);

  while (remainingA > 0 || remainingB > 0) {
    cost += 1;
    const digitA = (remainingA % 10) - borrow;
    const digitB = remainingB % 10;
    if (digitA < digitB) {
      cost += 1;
      borrow = 1;
    } else {
      borrow = 0;
    }
    remainingA = Math.floor(remainingA / 10);
    remainingB = Math.floor(remainingB / 10);
  }

  return cost;
}

export function integerMultiplyInternalCost(a: number, b: number): number {
  if (isFreeMultiply(a, b)) return 0;

  const digitsA = digitsOf(a);
  const digitsB = digitsOf(b);
  let cost = 0;
  const partials: number[] = [];

  for (let i = 0; i < digitsB.length; i += 1) {
    let carry = 0;
    let partial = 0;
    for (let j = 0; j < digitsA.length; j += 1) {
      cost += 1;
      const product = digitsA[j] * digitsB[i] + carry;
      carry = Math.floor(product / 10);
      partial += (product % 10) * 10 ** j;
    }
    if (carry > 0) {
      partial += carry * 10 ** digitsA.length;
    }
    partials.push(partial * 10 ** i);
  }

  let running = 0;
  for (const partial of partials) {
    cost += integerAddInternalCost(running, partial);
    running += partial;
  }

  return cost;
}

export function integerDivideInternalCost(dividend: number, divisor: number): number {
  if (divisor === 0) return 4;
  if (isFreeDivide(dividend, divisor)) return 0;

  const absDivisor = Math.abs(divisor);
  const absDividend = Math.abs(dividend);
  if (absDivisor > absDividend) return 1;

  if (absDivisor <= 9 && absDividend <= 99) {
    const quotient = absDividend / absDivisor;
    if (Number.isInteger(quotient) && quotient <= 9) {
      return 1;
    }
  }

  let cost = 0;
  let remainder = absDividend;

  while (remainder >= absDivisor) {
    cost += 1;
    const quotientDigit = Math.floor(remainder / absDivisor);
    const product = quotientDigit * absDivisor;
    cost += integerMultiplyInternalCost(quotientDigit, absDivisor);
    cost += integerSubtractInternalCost(remainder, product);
    remainder -= product;
    if (quotientDigit === 0) break;
    if (remainder > 0 && remainder < absDivisor) break;
  }

  return Math.max(1, cost);
}

/**
 * 分數→小數的長除法成本。
 *
 * 為何不直接用 integerDivideInternalCost(num, den)：真分數（num < den）如 1/11 會被
 * 當成「除數大於被除數」而回傳 1，嚴重低估。實際長除法必須先在被除數後補零，
 * 例如 1/11 其實是算 100 ÷ 11、1/4 是算 10 ÷ 4。補零會放大被除數、增加位數與運算量，
 * 因此改以「補零後的被除數 ÷ 除數」估算，並額外計入每個補零（帶下一位）的心智動作。
 */
export function fractionToDecimalInternalCost(numerator: number, denominator: number): number {
  const absDen = Math.abs(denominator);
  if (absDen <= 1) return 0;

  let paddedDividend = Math.abs(numerator);
  let padZeros = 0;
  while (paddedDividend < absDen) {
    paddedDividend *= 10;
    padZeros += 1;
  }

  return integerDivideInternalCost(paddedDividend, absDen) + padZeros;
}

export function integerInternalCost(operation: IntegerOperation, a: number, b: number): number {
  switch (operation) {
    case "add":
      return integerAddInternalCost(a, b);
    case "subtract":
      return integerSubtractInternalCost(a, b);
    case "multiply":
      return integerMultiplyInternalCost(a, b);
    case "divide":
      return integerDivideInternalCost(a, b);
    default:
      return 1;
  }
}

export function integerCost(operation: IntegerOperation, a: number, b: number): number {
  return integerInternalCost(operation, a, b) * CHUNK_CONSTANTS.integer;
}

const FRACTION_INTERNAL_INTEGER_FACTOR = 0.6;
const MIN_UNLIKE_DENOM_INTERNAL = 7;

function fractionIntegerInternalCost(operation: IntegerOperation, a: number, b: number): number {
  return integerInternalCost(operation, a, b) * FRACTION_INTERNAL_INTEGER_FACTOR;
}

function gcdInternalCost(a: number, b: number): number {
  let steps = 0;
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    steps += 1;
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return Math.max(1, steps) * CHUNK_CONSTANTS.gcd;
}

function applyTwoDigitBonus(cost: number, operands: Array<[number, number]>): number {
  const hasTwoDigit = operands.some(([left, right]) => isTwoDigitMultiply(left, right));
  return hasTwoDigit ? cost * TWO_DIGIT_MULTIPLY_BONUS : cost;
}

function lcmChunkCost(leftDen: number, rightDen: number): number {
  const common = fractionLcm(leftDen, rightDen);
  const shared = fractionGcd(leftDen, rightDen);
  const reducedA = leftDen / shared;

  const operands: Array<[number, number]> = [
    [reducedA, rightDen],
    [leftDen, rightDen],
  ];

  let internal =
    gcdInternalCost(leftDen, rightDen) +
    fractionIntegerInternalCost("multiply", reducedA, rightDen);

  internal = Math.max(internal, 2);

  let effective = internal * lcmTierMultiplier(common);
  effective = applyTwoDigitBonus(effective, operands);
  return effective;
}

function expandFractionCost(numerator: number, denominator: number, commonDen: number): number {
  const scale = commonDen / denominator;
  const operands: Array<[number, number]> = [[numerator, scale]];
  let internal = fractionIntegerInternalCost("multiply", numerator, scale);
  internal = Math.max(internal, scale === 1 ? 0 : 1);
  let effective = internal * CHUNK_CONSTANTS.expandFraction;
  effective = applyTwoDigitBonus(effective, operands);
  return effective;
}

export function fractionSimplificationCost(numerator: number, denominator: number): number {
  const shared = fractionGcd(numerator, denominator);
  if (shared <= 1) {
    return gcdInternalCost(numerator, denominator) * CHUNK_CONSTANTS.fractionSimplification;
  }
  const internal =
    gcdInternalCost(numerator, denominator) +
    fractionIntegerInternalCost("divide", numerator, shared) +
    fractionIntegerInternalCost("divide", denominator, shared);
  return internal * CHUNK_CONSTANTS.fractionSimplification;
}

function fractionOperationConstant(operation: FractionOperation): number {
  switch (operation) {
    case "add":
      return CHUNK_CONSTANTS.fractionAdd;
    case "subtract":
      return CHUNK_CONSTANTS.fractionSubtract;
    case "multiply":
      return CHUNK_CONSTANTS.fractionMultiply;
    case "divide":
      return CHUNK_CONSTANTS.fractionDivide;
    default:
      return 1;
  }
}

export function fractionInternalCost(operation: FractionOperation, left: Fraction, right: Fraction): number {
  if (operation === "multiply") {
    const numCost = fractionIntegerInternalCost("multiply", left.num, right.num);
    const denCost = fractionIntegerInternalCost("multiply", left.den, right.den);
    const simplify = fractionSimplificationCost(left.num * right.num, left.den * right.den);
    return numCost + denCost + simplify;
  }

  if (operation === "divide") {
    const numCost = fractionIntegerInternalCost("multiply", left.num, right.den);
    const denCost = fractionIntegerInternalCost("multiply", left.den, right.num);
    const simplify = fractionSimplificationCost(left.num * right.den, left.den * right.num);
    return numCost + denCost + simplify + 1;
  }

  if (left.den === right.den) {
    const numerator =
      operation === "add" ? left.num + right.num : left.num - right.num;
    const numeratorCost = fractionIntegerInternalCost(
      operation === "add" ? "add" : "subtract",
      left.num,
      right.num,
    );
    const simplify = fractionSimplificationCost(numerator, left.den);
    return numeratorCost + simplify;
  }

  const common = fractionLcm(left.den, right.den);
  const lcmCost = lcmChunkCost(left.den, right.den);
  const expandCost =
    expandFractionCost(left.num, left.den, common) +
    expandFractionCost(right.num, right.den, common);
  const leftScaled = left.num * (common / left.den);
  const rightScaled = right.num * (common / right.den);
  const numerator =
    operation === "add" ? leftScaled + rightScaled : leftScaled - rightScaled;
  const numeratorCost = fractionIntegerInternalCost(
    operation === "add" ? "add" : "subtract",
    leftScaled,
    rightScaled,
  );
  const simplify = fractionSimplificationCost(numerator, common);
  return lcmCost + expandCost + numeratorCost + simplify;
}

export function fractionCost(operation: FractionOperation, left: Fraction, right: Fraction): number {
  let internal = fractionInternalCost(operation, left, right);
  if (
    (operation === "add" || operation === "subtract") &&
    left.den !== right.den
  ) {
    internal = Math.max(internal, MIN_UNLIKE_DENOM_INTERNAL);
  }
  return internal * fractionOperationConstant(operation);
}

function powerInternalCost(n: number, exponent: 2 | 3 | 4): number {
  const abs = Math.abs(n);
  if (exponent === 2) {
    return integerInternalCost("multiply", abs, abs);
  }
  if (exponent === 3) {
    const square = abs * abs;
    return integerInternalCost("multiply", abs, abs) + integerInternalCost("multiply", square, abs);
  }
  const square = abs * abs;
  return integerInternalCost("multiply", abs, abs) + integerInternalCost("multiply", square, square);
}

function rootInternalCost(radicand: number): number {
  const root = Math.sqrt(radicand);
  if (!Number.isInteger(root)) return 2;
  if (root <= 10) return 1;
  if (root <= 16) return 2;
  return 3;
}

export function calculateCost(node: CostNode): number {
  switch (node.kind) {
    case "integer":
      return integerCost(node.operation, node.a, node.b);
    case "fraction":
      return fractionCost(node.operation, node.left, node.right);
    case "absolute-value":
      return (node.inner ? calculateCost(node.inner) : 0) + CHUNK_CONSTANTS.absoluteValue;
    case "power":
      return powerInternalCost(node.n, node.exponent) * CHUNK_CONSTANTS.power;
    case "root":
      return rootInternalCost(node.radicand) * CHUNK_CONSTANTS.root;
    case "symbolic-simplify":
      return 4 * CHUNK_CONSTANTS.symbolicSimplify;
    case "sum":
      return node.nodes.reduce((total, child) => total + calculateCost(child), 0);
    default:
      return 0;
  }
}

export function calculateQuestionCost(nodes: readonly CostNode[]): number {
  const base = nodes.reduce((total, node) => total + calculateCost(node), 0);
  return base + Math.max(0, nodes.length - 1) * MULTI_STEP_COORDINATION_COST;
}

export interface CostBreakdown {
  label: string;
  internalCost: number;
  effectiveCost: number;
}

export function describeCost(node: CostNode): {
  node: CostNode;
  effectiveCost: number;
  breakdown: CostBreakdown[];
} {
  const breakdown: CostBreakdown[] = [];

  if (node.kind === "integer") {
    const internal = integerInternalCost(node.operation, node.a, node.b);
    const effective = internal * CHUNK_CONSTANTS.integer;
    breakdown.push({ label: `integer-${node.operation}`, internalCost: internal, effectiveCost: effective });
    return { node, effectiveCost: effective, breakdown };
  }

  if (node.kind === "fraction") {
    const internal = fractionInternalCost(node.operation, node.left, node.right);
    const constant = fractionOperationConstant(node.operation);
    const effective = internal * constant;
    breakdown.push({ label: `fraction-${node.operation}`, internalCost: internal, effectiveCost: effective });
    return { node, effectiveCost: effective, breakdown };
  }

  const effective = calculateCost(node);
  breakdown.push({ label: node.kind, internalCost: effective, effectiveCost: effective });
  return { node, effectiveCost: effective, breakdown };
}
