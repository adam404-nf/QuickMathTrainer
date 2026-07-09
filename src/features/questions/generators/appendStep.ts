import { rebuildOptionsFormatted } from "../answerPath";
import { calculateMentalCost, type CalculationTemplateSpec } from "../calculationTemplates";
import {
  formatFraction,
  hasTerminatingDecimal,
  randomProperFraction,
  simplifyFraction,
  type Fraction,
} from "../fractionMath";
import { hasTrivialCancelViolation } from "../nonZeroStep";
import type { GenerateQuestionInput, Question } from "../types";
import {
  canAppendOperationKind,
  isCategoryAllowed,
  isThemeCategory,
  themeStepTarget,
  type OperationKind,
  type TemplateCategory,
} from "../selectionPolicy";
import {
  createQuestionId,
  formatDecimal,
  normalizeAnswer,
  parseNumericAnswer,
  pickOne,
  randomInt,
  shuffle,
} from "../utils";

/** 防止無限迴圈的安全上限；設計上步驟數量沒有硬性上限。 */
export const MAX_APPEND_STEPS = 30;

function uniqueTags(tags: readonly string[]): string[] {
  return [...new Set(tags)];
}

function stripPromptSuffix(prompt: string): string {
  return prompt
    .replace(/\s*（小數）\s*$/, "")
    .replace(/\s*（分數）\s*$/, "")
    .replace(/ = \?$/, "");
}

function parseFractionAnswer(answer: string): Fraction | undefined {
  const match = normalizeAnswer(answer).match(/^(-?\d+)\/(-?\d+)$/);
  if (!match) {
    return undefined;
  }

  const den = Number(match[2]);
  if (den === 0) {
    return undefined;
  }

  return simplifyFraction({ num: Number(match[1]), den });
}

function operandRange(difficulty: Question["difficulty"]): { min: number; max: number } {
  return {
    easy: { min: 2, max: 9 },
    medium: { min: 2, max: 15 },
    hard: { min: 3, max: 20 },
    extreme: { min: 6, max: 30 },
  }[difficulty];
}

function divisors(n: number): number[] {
  const abs = Math.abs(n);
  const result: number[] = [];
  for (let divisor = 2; divisor <= Math.min(abs, 12); divisor += 1) {
    if (abs % divisor === 0) {
      result.push(divisor);
    }
  }
  return result;
}

function rebuildQuestion(
  question: Question,
  params: {
    prompt: string;
    answer: string;
    costTemplates: CalculationTemplateSpec[];
    tags?: string[];
    techniqueStep: string;
    needsAnswerPath?: boolean;
    rationalValue?: number;
    answerFormat?: Question["answerFormat"];
  },
): Question {
  const { prompt, answer, costTemplates, techniqueStep } = params;

  return {
    ...question,
    id: createQuestionId([question.type, prompt, answer]),
    prompt,
    answer,
    mentalCost: calculateMentalCost(costTemplates, answer),
    costTemplates,
    tags: uniqueTags([...question.tags, ...(params.tags ?? []), "working-memory"]),
    needsAnswerPath: params.needsAnswerPath ?? question.needsAnswerPath,
    rationalValue: params.rationalValue ?? question.rationalValue,
    answerFormat: params.answerFormat ?? question.answerFormat,
    technique: {
      name: "多步心算",
      steps: [...question.technique.steps, techniqueStep],
    },
    options: rebuildOptionsFormatted(
      answer,
      params.answerFormat ?? question.answerFormat,
      question.kind,
      [],
      question.options,
    ),
  };
}

type AppendBuilder = {
  category: TemplateCategory;
  operationKind: OperationKind;
  build: () => Question | undefined;
};

function pickAppendCandidate(
  question: Question,
  builders: AppendBuilder[],
  input?: GenerateQuestionInput,
): Question | undefined {
  const mode = input?.mode ?? question.type;
  const existing = question.costTemplates ?? [];

  const eligible = builders.filter((builder) => {
    if (!isCategoryAllowed(mode, builder.category)) {
      return false;
    }
    if (!canAppendOperationKind(existing, builder.operationKind)) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return undefined;
  }

  const relaxed = input?.relaxedConstraints ?? [];
  const themeTarget = relaxed.includes("theme-ratio")
    ? 0
    : themeStepTarget(input ?? { mode, targetTags: input?.targetTags });
  let pool = eligible;

  if (themeTarget > 0) {
    const themeContext = { mode, targetTags: input?.targetTags };
    const themePool = eligible.filter((builder) => isThemeCategory(themeContext, builder.category));
    const nonThemePool = eligible.filter(
      (builder) => !isThemeCategory(themeContext, builder.category),
    );
    const preferTheme = Math.random() < themeTarget;
    if (preferTheme && themePool.length > 0) {
      pool = themePool;
    } else if (!preferTheme && nonThemePool.length > 0) {
      pool = nonThemePool;
    } else if (themePool.length > 0) {
      pool = themePool;
    }
  }

  for (const { build } of shuffle(pool)) {
    const candidate = build();
    if (!candidate || candidate.mentalCost <= question.mentalCost) {
      continue;
    }
    if (hasTrivialCancelViolation(candidate.costTemplates ?? [])) {
      continue;
    }
    return candidate;
  }
  return undefined;
}

function isSubtractionFocused(input?: GenerateQuestionInput): boolean {
  return input?.mode === "weakness-focused" && (input.targetTags?.includes("subtraction") ?? false);
}

function formatAppendAnswer(value: number): string {
  return hasTerminatingDecimal(value) ? formatDecimal(value) : String(value);
}

function integerAppendBuilders(
  question: Question,
  currentValue: number,
  input?: GenerateQuestionInput,
  options?: { relaxIntegerBase?: boolean },
): AppendBuilder[] {
  if (!Number.isFinite(currentValue)) {
    return [];
  }
  if (!options?.relaxIntegerBase && !Number.isInteger(currentValue)) {
    return [];
  }

  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];
  const { min, max } = operandRange(question.difficulty);
  const builders: AppendBuilder[] = [
    {
      category: "integer",
      operationKind: "integer-add",
      build: () => {
        const b = randomInt(min, max);
        const answer = currentValue + b;
        const template: CalculationTemplateSpec = { kind: "integer-add", a: currentValue, b };
        return rebuildQuestion(question, {
          prompt: `${baseExpr} + ${b} = ?`,
          answer: formatAppendAnswer(answer),
          costTemplates: [...existing, template],
          tags: ["addition"],
          techniqueStep: `${currentValue} + ${b} = ${answer}`,
        });
      },
    },
  ];

  if (currentValue > min) {
    builders.push({
      category: "integer",
      operationKind: "integer-subtract",
      build: () => {
        const upper = Math.min(max, Math.floor(currentValue - 1));
        if (upper < min) {
          return undefined;
        }
        const b = randomInt(min, upper);
        if (currentValue - b <= 0) {
          return undefined;
        }
        const answer = currentValue - b;
        const template: CalculationTemplateSpec = { kind: "integer-subtract", a: currentValue, b };
        return rebuildQuestion(question, {
          prompt: `${baseExpr} − ${b} = ?`,
          answer: formatAppendAnswer(answer),
          costTemplates: [...existing, template],
          tags: ["subtraction"],
          techniqueStep: `${currentValue} − ${b} = ${answer}`,
        });
      },
    });
  }

  if (Number.isInteger(currentValue)) {
    builders.push({
      category: "integer",
      operationKind: "integer-multiply",
      build: () => {
        const b = randomInt(2, Math.min(max, 12));
        const answer = currentValue * b;
        const template: CalculationTemplateSpec = { kind: "integer-multiply", a: currentValue, b };
        return rebuildQuestion(question, {
          prompt: `(${baseExpr}) × ${b} = ?`,
          answer: formatAppendAnswer(answer),
          costTemplates: [...existing, template],
          tags: ["multiplication", "order-of-operations"],
          techniqueStep: `${currentValue} × ${b} = ${answer}`,
        });
      },
    });
    builders.push({
      category: "integer",
      operationKind: "integer-divide",
      build: () => {
        const factors = divisors(currentValue);
        if (factors.length === 0) {
          return undefined;
        }
        const divisor = pickOne(factors);
        const answer = currentValue / divisor;
        if (!Number.isInteger(answer)) {
          return undefined;
        }
        const template: CalculationTemplateSpec = {
          kind: "integer-divide",
          dividend: currentValue,
          divisor,
        };
        return rebuildQuestion(question, {
          prompt: `(${baseExpr}) ÷ ${divisor} = ?`,
          answer: String(answer),
          costTemplates: [...existing, template],
          tags: ["division", "order-of-operations"],
          techniqueStep: `${currentValue} ÷ ${divisor} = ${answer}`,
        });
      },
    });
  }

  return builders;
}

function appendIntegerOperation(
  question: Question,
  currentValue: number,
  input?: GenerateQuestionInput,
): Question | undefined {
  if (!Number.isInteger(currentValue)) {
    return undefined;
  }

  const existing = question.costTemplates ?? [];

  if (isSubtractionFocused(input)) {
    if (!canAppendOperationKind(existing, "integer-subtract")) {
      return undefined;
    }
    const baseExpr = stripPromptSuffix(question.prompt);
    const { min, max } = operandRange(question.difficulty);
    const b = randomInt(min, Math.min(max, currentValue - 1));
    if (b < min || currentValue - b <= 0) {
      return undefined;
    }
    const answer = currentValue - b;
    const template: CalculationTemplateSpec = { kind: "integer-subtract", a: currentValue, b };
    const nextTemplates = [...existing, template];
    if (hasTrivialCancelViolation(nextTemplates)) {
      return undefined;
    }
    return rebuildQuestion(question, {
      prompt: `${baseExpr} − ${b} = ?`,
      answer: String(answer),
      costTemplates: nextTemplates,
      tags: ["subtraction"],
      techniqueStep: `${currentValue} − ${b} = ${answer}`,
    });
  }

  const builders = integerAppendBuilders(question, currentValue, input);
  return pickAppendCandidate(question, builders, input);
}

function decimalAppendBuilders(question: Question, currentValue: number): AppendBuilder[] {
  if (!hasTerminatingDecimal(currentValue)) {
    return [];
  }

  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];
  const { max } = operandRange(question.difficulty);

  return [
    {
      category: "decimal",
      operationKind: "decimal-add",
      build: () => {
        const addend = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
        const answer = Number((currentValue + addend).toFixed(4));
        const template: CalculationTemplateSpec = { kind: "decimal-add", left: currentValue, right: addend };
        return rebuildQuestion(question, {
          prompt: `${baseExpr} + ${formatDecimal(addend)} = ?`,
          answer: formatDecimal(answer),
          costTemplates: [...existing, template],
          tags: ["decimals", "addition"],
          needsAnswerPath: true,
          rationalValue: answer,
          techniqueStep: `${formatDecimal(currentValue)} + ${formatDecimal(addend)} = ${formatDecimal(answer)}`,
        });
      },
    },
    {
      category: "decimal",
      operationKind: "decimal-subtract",
      build: () => {
        const subtrahend = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
        const answer = Number((currentValue - subtrahend).toFixed(4));
        if (answer <= 0) {
          return undefined;
        }
        const template: CalculationTemplateSpec = {
          kind: "decimal-subtract",
          whole: currentValue,
          fraction: subtrahend,
        };
        return rebuildQuestion(question, {
          prompt: `${baseExpr} − ${formatDecimal(subtrahend)} = ?`,
          answer: formatDecimal(answer),
          costTemplates: [...existing, template],
          tags: ["decimals", "subtraction"],
          needsAnswerPath: true,
          rationalValue: answer,
          techniqueStep: `${formatDecimal(currentValue)} − ${formatDecimal(subtrahend)} = ${formatDecimal(answer)}`,
        });
      },
    },
    {
      category: "decimal",
      operationKind: "decimal-multiply",
      build: () => {
        const multiplier = randomInt(2, Math.min(max, 9));
        const answer = Number((currentValue * multiplier).toFixed(4));
        const template: CalculationTemplateSpec = {
          kind: "decimal-multiply",
          decimal: currentValue,
          integer: multiplier,
        };
        return rebuildQuestion(question, {
          prompt: `(${baseExpr}) × ${multiplier} = ?`,
          answer: formatDecimal(answer),
          costTemplates: [...existing, template],
          tags: ["decimals", "multiplication", "order-of-operations"],
          needsAnswerPath: true,
          rationalValue: answer,
          techniqueStep: `${formatDecimal(currentValue)} × ${multiplier} = ${formatDecimal(answer)}`,
        });
      },
    },
  ];
}

function appendDecimalOperation(
  question: Question,
  currentValue: number,
  input?: GenerateQuestionInput,
): Question | undefined {
  const builders = decimalAppendBuilders(question, currentValue);
  if (builders.length === 0) {
    return undefined;
  }
  return pickAppendCandidate(question, builders, input);
}

function fractionAppendBuilders(question: Question, left: Fraction): AppendBuilder[] {
  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];

  return [
    {
      category: "fraction",
      operationKind: "fraction-unlike-denom",
      build: () => {
        const right = randomProperFraction(question.difficulty);
        if (right.den === left.den) {
          return undefined;
        }
        const result = simplifyFraction({
          num: left.num * right.den + right.num * left.den,
          den: left.den * right.den,
        });
        const template: CalculationTemplateSpec = {
          kind: "fraction-unlike-denom",
          left,
          right,
          op: "+",
        };
        const answer = formatFraction(result);
        if (answer.includes("/0")) {
          return undefined;
        }
        return rebuildQuestion(question, {
          prompt: `${baseExpr} + ${formatFraction(right)} = ?`,
          answer,
          costTemplates: [...existing, template],
          tags: ["addition"],
          needsAnswerPath: true,
          rationalValue: result.num / result.den,
          techniqueStep: `${formatFraction(left)} + ${formatFraction(right)} = ${formatFraction(result)}`,
        });
      },
    },
    {
      category: "fraction",
      operationKind: "fraction-unlike-denom",
      build: () => {
        const right = randomProperFraction(question.difficulty);
        if (right.den === left.den) {
          return undefined;
        }
        const result = simplifyFraction({
          num: left.num * right.den - right.num * left.den,
          den: left.den * right.den,
        });
        if (result.num <= 0) {
          return undefined;
        }
        const template: CalculationTemplateSpec = {
          kind: "fraction-unlike-denom",
          left,
          right,
          op: "−",
        };
        const answer = formatFraction(result);
        if (answer.includes("/0")) {
          return undefined;
        }
        return rebuildQuestion(question, {
          prompt: `${baseExpr} − ${formatFraction(right)} = ?`,
          answer,
          costTemplates: [...existing, template],
          tags: ["subtraction"],
          needsAnswerPath: true,
          rationalValue: result.num / result.den,
          techniqueStep: `${formatFraction(left)} − ${formatFraction(right)} = ${formatFraction(result)}`,
        });
      },
    },
    {
      category: "fraction",
      operationKind: "fraction-multiply",
      build: () => {
        const right = randomProperFraction(question.difficulty);
        const result = simplifyFraction({ num: left.num * right.num, den: left.den * right.den });
        const template: CalculationTemplateSpec = { kind: "fraction-multiply", left, right };
        const answer = formatFraction(result);
        if (answer.includes("/0")) {
          return undefined;
        }
        return rebuildQuestion(question, {
          prompt: `${baseExpr} × ${formatFraction(right)} = ?`,
          answer,
          costTemplates: [...existing, template],
          tags: ["multiplication"],
          needsAnswerPath: true,
          rationalValue: result.num / result.den,
          techniqueStep: `${formatFraction(left)} × ${formatFraction(right)} = ${formatFraction(result)}`,
        });
      },
    },
    {
      category: "fraction",
      operationKind: "fraction-divide",
      build: () => {
        const right = randomProperFraction(question.difficulty);
        if (right.num === 0) {
          return undefined;
        }
        const result = simplifyFraction({ num: left.num * right.den, den: left.den * right.num });
        const template: CalculationTemplateSpec = { kind: "fraction-divide", left, right };
        const answer = formatFraction(result);
        if (answer.includes("/0")) {
          return undefined;
        }
        return rebuildQuestion(question, {
          prompt: `${baseExpr} ÷ ${formatFraction(right)} = ?`,
          answer,
          costTemplates: [...existing, template],
          tags: ["division"],
          needsAnswerPath: true,
          rationalValue: result.num / result.den,
          techniqueStep: `${formatFraction(left)} ÷ ${formatFraction(right)} = ${formatFraction(result)}`,
        });
      },
    },
  ];
}

function appendFractionOperation(
  question: Question,
  left: Fraction,
  input?: GenerateQuestionInput,
): Question | undefined {
  const builders = fractionAppendBuilders(question, left);
  if (builders.length === 0) {
    return undefined;
  }
  return pickAppendCandidate(question, builders, input);
}

function specialtyIntegerAppendBuilders(
  question: Question,
  currentValue: number,
  input?: GenerateQuestionInput,
): AppendBuilder[] {
  const mode = input?.mode ?? question.type;
  if (!isCategoryAllowed(mode, "integer")) {
    return [];
  }
  return integerAppendBuilders(question, currentValue, input, { relaxIntegerBase: true });
}

export function appendArithmeticStep(question: Question, input?: GenerateQuestionInput): Question | undefined {
  const value = parseNumericAnswer(question.answer);
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return appendIntegerOperation(question, value, input);
}

export function appendPowersStep(question: Question, input?: GenerateQuestionInput): Question | undefined {
  const value = parseNumericAnswer(question.answer);
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return appendIntegerOperation(question, value, input);
}

export function appendFractionStep(question: Question, input?: GenerateQuestionInput): Question | undefined {
  const preferDecimal =
    input?.mode === "weakness-focused" && (input.targetTags?.includes("decimals") ?? false);

  const decimalValue = parseNumericAnswer(question.answer);
  const left = parseFractionAnswer(question.answer);
  const builders: AppendBuilder[] = [];

  if (preferDecimal && decimalValue !== undefined && hasTerminatingDecimal(decimalValue)) {
    // Weakness decimals: stay on decimal theme builders (Task 6 preferDecimal path).
    builders.push(...decimalAppendBuilders(question, decimalValue));
  } else if (left) {
    builders.push(...fractionAppendBuilders(question, left));
  } else if (decimalValue !== undefined && hasTerminatingDecimal(decimalValue)) {
    builders.push(...decimalAppendBuilders(question, decimalValue));
  }

  // Specialty fractions mode: allow integer non-theme appends (~30%) for theme ~70%.
  // Skip for weakness-focused decimals so preferDecimal stays on decimal theme.
  if (
    !preferDecimal &&
    decimalValue !== undefined &&
    Number.isFinite(decimalValue)
  ) {
    builders.push(...specialtyIntegerAppendBuilders(question, decimalValue, input));
  }

  if (builders.length === 0) {
    return undefined;
  }

  return pickAppendCandidate(question, builders, input);
}

export function appendCostStep(question: Question, input?: GenerateQuestionInput): Question | undefined {
  switch (question.type) {
    case "arithmetic":
      return appendArithmeticStep(question, input);
    case "powers":
      return appendPowersStep(question, input);
    case "fractions":
      return appendFractionStep(question, input);
    default:
      return undefined;
  }
}
