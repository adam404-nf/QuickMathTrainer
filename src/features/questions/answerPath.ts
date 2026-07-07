import {
  calculateMentalCost,
  type CalculationTemplateSpec,
} from "./calculationTemplates";
import {
  decimalToFractionParts,
  formatFraction,
  hasTerminatingDecimal,
  rationalToFraction,
  simplifyFraction,
  type Fraction,
} from "./fractionMath";
import type { MentalCostBucket } from "./mentalCost";
import { matchesMentalCostBucket } from "./mentalCost";
import type { AnswerFormat, Question, QuestionKind } from "./types";
import {
  createQuestionId,
  formatDecimal,
  normalizeAnswer,
  parseNumericAnswer,
  shuffle,
} from "./utils";

export type PathCostResult = {
  costTemplates: CalculationTemplateSpec[];
  mentalCost: number;
};

export const SECONDARY_SPECIALTY_TAGS = new Set(["working-memory", "order-of-operations"]);

export function deriveSpecialtyTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => !SECONDARY_SPECIALTY_TAGS.has(tag));
}

export function answerFormatSuffix(format: AnswerFormat): string {
  return format === "decimal" ? "（小數）" : "（分數）";
}

export function formatAnswerByKind(value: number, format: AnswerFormat): string {
  if (format === "decimal") {
    return formatDecimal(value);
  }
  return formatFraction(rationalToFraction(value));
}

export function stripAnswerFormatSuffix(prompt: string): string {
  return prompt
    .replace(/\s*（小數）\s*$/, "")
    .replace(/\s*（分數）\s*$/, "")
    .replace(/\s*\(小數\)\s*$/, "")
    .replace(/\s*\(分數\)\s*$/, "")
    .replace(/ = \?$/, "");
}

export function pickBetweenValidPaths(validPaths: readonly AnswerFormat[]): AnswerFormat {
  if (validPaths.length === 1) {
    return validPaths[0];
  }
  return Math.random() < 0.7 ? "fraction" : "decimal";
}

function decimalToFractionSpec(decimal: number): CalculationTemplateSpec {
  const { num, den } = decimalToFractionParts(decimal);
  return { kind: "decimal-to-fraction", decimal, numerator: num, denominator: den };
}

function fractionToDecimalSpec(fraction: Fraction): CalculationTemplateSpec {
  return {
    kind: "fraction-to-decimal-explicit",
    numerator: fraction.num,
    denominator: fraction.den,
  };
}

function fractionOpFromDecimalOp(
  spec: Extract<CalculationTemplateSpec, { kind: "decimal-add" | "decimal-subtract" | "decimal-multiply" }>,
): CalculationTemplateSpec {
  if (spec.kind === "decimal-add") {
    const left = decimalToFractionParts(spec.left);
    const right = decimalToFractionParts(spec.right);
    return left.den === right.den
      ? { kind: "fraction-same-denom", denominator: left.den }
      : { kind: "fraction-unlike-denom", left, right };
  }
  if (spec.kind === "decimal-subtract") {
    const left = decimalToFractionParts(spec.whole);
    const right = decimalToFractionParts(spec.fraction);
    return { kind: "fraction-unlike-denom", left, right };
  }
  const left = decimalToFractionParts(spec.decimal);
  const right: Fraction = { num: spec.integer, den: 1 };
  return { kind: "fraction-multiply", left, right };
}

function decimalOpFromFractionOp(
  spec: Extract<
    CalculationTemplateSpec,
    { kind: "fraction-same-denom" | "fraction-unlike-denom" | "fraction-multiply" | "fraction-divide" }
  >,
): CalculationTemplateSpec | undefined {
  if (spec.kind === "fraction-same-denom") {
    return { kind: "decimal-add", left: 1 / spec.denominator, right: 1 / spec.denominator };
  }
  if (spec.kind === "fraction-unlike-denom") {
    return { kind: "decimal-add", left: spec.left.num / spec.left.den, right: spec.right.num / spec.right.den };
  }
  if (spec.kind === "fraction-multiply") {
    return {
      kind: "decimal-multiply",
      decimal: spec.left.num / spec.left.den,
      integer: spec.right.num / spec.right.den,
    };
  }
  return {
    kind: "decimal-multiply",
    decimal: spec.left.num / spec.left.den,
    integer: spec.right.den / spec.right.num,
  };
}

function remapTemplatesForPath(
  templates: readonly CalculationTemplateSpec[],
  path: AnswerFormat,
): CalculationTemplateSpec[] {
  const result: CalculationTemplateSpec[] = [];

  for (const spec of templates) {
    switch (spec.kind) {
      case "decimal-add":
      case "decimal-subtract":
      case "decimal-multiply":
        if (path === "fraction") {
          if (spec.kind === "decimal-add") {
            result.push(decimalToFractionSpec(spec.left), decimalToFractionSpec(spec.right));
          } else if (spec.kind === "decimal-subtract") {
            result.push(decimalToFractionSpec(spec.whole), decimalToFractionSpec(spec.fraction));
          } else {
            result.push(decimalToFractionSpec(spec.decimal));
          }
          result.push(fractionOpFromDecimalOp(spec));
        } else {
          result.push(spec);
        }
        break;
      case "decimal-square":
        result.push(spec);
        break;
      case "decimal-to-fraction":
        if (path === "fraction") {
          result.push(spec);
        }
        break;
      case "fraction-to-decimal":
      case "fraction-to-decimal-explicit":
        if (path === "decimal") {
          result.push(
            spec.kind === "fraction-to-decimal"
              ? { kind: "fraction-to-decimal-explicit", numerator: 1, denominator: spec.denominator }
              : spec,
          );
        }
        break;
      case "fraction-same-denom":
      case "fraction-unlike-denom":
      case "fraction-multiply":
      case "fraction-divide":
        if (path === "fraction") {
          result.push(spec);
        } else {
          if (spec.kind === "fraction-same-denom") {
            result.push(
              fractionToDecimalSpec({ num: 1, den: spec.denominator }),
              fractionToDecimalSpec({ num: 1, den: spec.denominator }),
            );
          } else if (spec.kind === "fraction-unlike-denom") {
            result.push(fractionToDecimalSpec(spec.left), fractionToDecimalSpec(spec.right));
          } else if (spec.kind === "fraction-multiply") {
            result.push(fractionToDecimalSpec(spec.left), fractionToDecimalSpec(spec.right));
          } else {
            result.push(fractionToDecimalSpec(spec.left), fractionToDecimalSpec(spec.right));
          }
          const decimalSpec = decimalOpFromFractionOp(spec);
          if (decimalSpec) {
            result.push(decimalSpec);
          }
        }
        break;
      case "decimal-fraction-add":
      case "decimal-fraction-subtract":
      case "decimal-fraction-multiply":
      case "decimal-fraction-divide":
        if (path === "fraction") {
          result.push(decimalToFractionSpec(spec.decimal));
          if (spec.op === "+") {
            result.push({ kind: "fraction-unlike-denom", left: spec.fraction, right: spec.fraction });
          } else if (spec.op === "−") {
            result.push({ kind: "fraction-unlike-denom", left: spec.fraction, right: spec.fraction });
          } else if (spec.op === "×") {
            result.push({ kind: "fraction-multiply", left: spec.fraction, right: spec.fraction });
          } else {
            result.push({ kind: "fraction-divide", left: spec.fraction, right: spec.fraction });
          }
        } else {
          result.push(fractionToDecimalSpec(spec.fraction));
          if (spec.op === "+") {
            result.push({ kind: "decimal-add", left: spec.decimal, right: spec.decimal });
          } else if (spec.op === "−") {
            result.push({ kind: "decimal-subtract", whole: spec.decimal, fraction: spec.decimal });
          } else if (spec.op === "×") {
            result.push({ kind: "decimal-multiply", decimal: spec.decimal, integer: 1 });
          } else {
            result.push({ kind: "integer-divide", dividend: 1, divisor: 1 });
          }
        }
        break;
      default:
        result.push(spec);
        break;
    }
  }

  return result;
}

export function buildFractionPathCost(question: Question, answer?: string): PathCostResult {
  const templates = remapTemplatesForPath(question.costTemplates ?? [], "fraction");
  const formattedAnswer = answer ?? formatAnswerByKind(question.rationalValue ?? 0, "fraction");
  return {
    costTemplates: templates,
    mentalCost: calculateMentalCost(templates, formattedAnswer),
  };
}

export function buildDecimalPathCost(question: Question, answer?: string): PathCostResult {
  const templates = remapTemplatesForPath(question.costTemplates ?? [], "decimal");
  const formattedAnswer = answer ?? formatAnswerByKind(question.rationalValue ?? 0, "decimal");
  return {
    costTemplates: templates,
    mentalCost: calculateMentalCost(templates, formattedAnswer),
  };
}

export function formatDistractor(value: number | string, format?: AnswerFormat): string {
  if (typeof value === "string") {
    return value;
  }
  if (format === "fraction") {
    return formatFraction(rationalToFraction(value));
  }
  if (format === "decimal") {
    return formatDecimal(value);
  }
  return String(value);
}

export function rebuildOptionsFormatted(
  answer: string,
  format: AnswerFormat | undefined,
  kind: QuestionKind,
  distractors: readonly string[] = [],
  previousOptions?: string[],
): string[] | undefined {
  if (kind === "fill-in") {
    return undefined;
  }

  const numeric = parseNumericAnswer(answer);
  const pool = [...new Set(distractors.filter((item) => item !== answer))];

  if (numeric !== undefined) {
    for (let offset = 1; pool.length < 3 && offset <= 20; offset += 1) {
      for (const candidate of [numeric + offset * 0.1, numeric - offset * 0.1, numeric + offset, numeric - offset]) {
        const formatted = formatDistractor(candidate, format);
        if (formatted !== answer && !pool.includes(formatted)) {
          pool.push(formatted);
        }
        if (pool.length >= 3) {
          break;
        }
      }
    }
  }

  if (pool.length < 3 && previousOptions) {
    for (const option of previousOptions) {
      if (option !== answer && !pool.includes(option)) {
        pool.push(option);
      }
    }
  }

  const selected = shuffle(pool).slice(0, 3);
  return shuffle([answer, ...selected]);
}

/** 優先解析答案字串中的精確分數，避免以浮點承載有理數（如 25/12）而遺失精度。 */
function exactRationalFraction(question: Question): Fraction | undefined {
  const match = normalizeAnswer(question.answer).match(/^(-?\d+)\/(-?\d+)$/);
  if (match) {
    const den = Number(match[2]);
    if (den !== 0) {
      return simplifyFraction({ num: Number(match[1]), den });
    }
  }

  const numeric = question.rationalValue ?? parseNumericAnswer(question.answer);
  if (numeric === undefined || !Number.isFinite(numeric)) {
    return undefined;
  }
  return rationalToFraction(numeric);
}

/** 直接以精確分母判定是否為有限小數（質因數僅含 2、5）。 */
function fractionTerminates(fraction: Fraction): boolean {
  let den = Math.abs(fraction.den);
  while (den % 2 === 0) den /= 2;
  while (den % 5 === 0) den /= 5;
  return den === 1;
}

export function resolveAnswerPath(question: Question, range: MentalCostBucket): Question | undefined {
  if (!question.needsAnswerPath) {
    return question;
  }

  const fraction = exactRationalFraction(question);
  if (!fraction) {
    return undefined;
  }

  const value = fraction.num / fraction.den;

  if (fraction.den === 1) {
    const basePrompt = stripAnswerFormatSuffix(question.prompt);
    const prompt = `${basePrompt} = ?`;
    const answer = String(fraction.num);
    return {
      ...question,
      id: createQuestionId([question.type, prompt, answer]),
      prompt,
      answer,
      needsAnswerPath: false,
      rationalValue: undefined,
      options: rebuildOptionsFormatted(answer, undefined, question.kind, [], question.options),
    };
  }

  const terminating = fractionTerminates(fraction);
  const basePrompt = stripAnswerFormatSuffix(question.prompt);
  const fractionPath = buildFractionPathCost(question);
  const decimalPath = terminating ? buildDecimalPathCost(question) : undefined;

  const validPaths: AnswerFormat[] = [];
  if (matchesMentalCostBucket(fractionPath.mentalCost, range)) {
    validPaths.push("fraction");
  }
  if (decimalPath && matchesMentalCostBucket(decimalPath.mentalCost, range)) {
    validPaths.push("decimal");
  }

  if (validPaths.length === 0) {
    return undefined;
  }

  const chosen = pickBetweenValidPaths(validPaths);
  const pathResult = chosen === "fraction" ? fractionPath : decimalPath!;
  const answer = chosen === "fraction" ? formatFraction(fraction) : formatDecimal(value);
  const prompt = `${basePrompt} = ?${answerFormatSuffix(chosen)}`;

  return {
    ...question,
    id: createQuestionId([question.type, prompt, answer]),
    prompt,
    answer,
    answerFormat: chosen,
    mentalCost: pathResult.mentalCost,
    costTemplates: pathResult.costTemplates,
    needsAnswerPath: false,
    rationalValue: undefined,
    options: rebuildOptionsFormatted(answer, chosen, question.kind, [], question.options),
  };
}

export function getEffectiveSpecialtyTags(question: Question): string[] {
  if (question.specialtyTags && question.specialtyTags.length > 0) {
    return question.specialtyTags;
  }
  return deriveSpecialtyTags(question.tags);
}

export function isFiniteDecimalString(answer: string): boolean {
  const normalized = normalizeAnswer(answer);
  if (!normalized.includes(".")) {
    return false;
  }
  const value = parseNumericAnswer(normalized);
  return value !== undefined && hasTerminatingDecimal(value);
}
