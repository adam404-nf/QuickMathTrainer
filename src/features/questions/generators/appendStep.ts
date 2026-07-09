import { rebuildOptionsFormatted } from "../answerPath";
import { calculateMentalCost, type CalculationTemplateSpec } from "../calculationTemplates";
import {
  formatFraction,
  hasTerminatingDecimal,
  randomProperFraction,
  simplifyFraction,
  type Fraction,
} from "../fractionMath";
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

  const themeTarget = themeStepTarget(input ?? { mode, targetTags: input?.targetTags });
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
    if (candidate && candidate.mentalCost > question.mentalCost) {
      return candidate;
    }
  }
  return undefined;
}

function isSubtractionFocused(input?: GenerateQuestionInput): boolean {
  return input?.mode === "weakness-focused" && (input.targetTags?.includes("subtraction") ?? false);
}

function appendIntegerOperation(
  question: Question,
  currentValue: number,
  input?: GenerateQuestionInput,
): Question | undefined {
  if (!Number.isInteger(currentValue)) {
    return undefined;
  }

  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];
  const { min, max } = operandRange(question.difficulty);

  if (isSubtractionFocused(input)) {
    if (!canAppendOperationKind(existing, "integer-subtract")) {
      return undefined;
    }
    const b = randomInt(min, Math.min(max, currentValue - 1));
    if (b < min || currentValue - b <= 0) {
      return undefined;
    }
    const answer = currentValue - b;
    const template: CalculationTemplateSpec = { kind: "integer-subtract", a: currentValue, b };
    return rebuildQuestion(question, {
      prompt: `${baseExpr} − ${b} = ?`,
      answer: String(answer),
      costTemplates: [...existing, template],
      tags: ["subtraction"],
      techniqueStep: `${currentValue} − ${b} = ${answer}`,
    });
  }

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
          answer: String(answer),
          costTemplates: [...existing, template],
          tags: ["addition"],
          techniqueStep: `${currentValue} + ${b} = ${answer}`,
        });
      },
    },
    {
      category: "integer",
      operationKind: "integer-subtract",
      build: () => {
        const b = randomInt(min, Math.min(max, currentValue - 1));
        if (b < min || currentValue - b <= 0) {
          return undefined;
        }
        const answer = currentValue - b;
        const template: CalculationTemplateSpec = { kind: "integer-subtract", a: currentValue, b };
        return rebuildQuestion(question, {
          prompt: `${baseExpr} − ${b} = ?`,
          answer: String(answer),
          costTemplates: [...existing, template],
          tags: ["subtraction"],
          techniqueStep: `${currentValue} − ${b} = ${answer}`,
        });
      },
    },
    {
      category: "integer",
      operationKind: "integer-multiply",
      build: () => {
        const b = randomInt(2, Math.min(max, 12));
        const answer = currentValue * b;
        const template: CalculationTemplateSpec = { kind: "integer-multiply", a: currentValue, b };
        return rebuildQuestion(question, {
          prompt: `(${baseExpr}) × ${b} = ?`,
          answer: String(answer),
          costTemplates: [...existing, template],
          tags: ["multiplication", "order-of-operations"],
          techniqueStep: `${currentValue} × ${b} = ${answer}`,
        });
      },
    },
    {
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
    },
  ];

  return pickAppendCandidate(question, builders, input);
}

function appendDecimalOperation(
  question: Question,
  currentValue: number,
  input?: GenerateQuestionInput,
): Question | undefined {
  if (!hasTerminatingDecimal(currentValue)) {
    return undefined;
  }

  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];
  const { max } = operandRange(question.difficulty);

  const builders: AppendBuilder[] = [
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

  return pickAppendCandidate(question, builders, input);
}

function appendFractionOperation(
  question: Question,
  left: Fraction,
  input?: GenerateQuestionInput,
): Question | undefined {
  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];

  const builders: AppendBuilder[] = [
    {
      category: "fraction",
      operationKind: "fraction-unlike-denom",
      build: () => {
        const right = randomProperFraction(question.difficulty);
        const result = simplifyFraction({
          num: left.num * right.den + right.num * left.den,
          den: left.den * right.den,
        });
        const template: CalculationTemplateSpec = { kind: "fraction-unlike-denom", left, right };
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
        const result = simplifyFraction({
          num: left.num * right.den - right.num * left.den,
          den: left.den * right.den,
        });
        if (result.num <= 0) {
          return undefined;
        }
        const template: CalculationTemplateSpec = { kind: "fraction-unlike-denom", left, right };
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

  return pickAppendCandidate(question, builders, input);
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
  if (preferDecimal && decimalValue !== undefined && hasTerminatingDecimal(decimalValue)) {
    return appendDecimalOperation(question, decimalValue, input);
  }

  const left = parseFractionAnswer(question.answer);
  if (left) {
    return appendFractionOperation(question, left, input);
  }

  if (decimalValue !== undefined && hasTerminatingDecimal(decimalValue)) {
    return appendDecimalOperation(question, decimalValue, input);
  }

  return undefined;
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
