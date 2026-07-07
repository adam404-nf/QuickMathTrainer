import { calculateMentalCost, type CalculationTemplateSpec } from "../calculationTemplates";
import {
  formatFraction,
  randomProperFraction,
  simplifyFraction,
  type Fraction,
} from "../fractionMath";
import type { Question, QuestionKind } from "../types";
import {
  createQuestionId,
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
  return prompt.replace(/ = \?$/, "");
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
  },
): Question {
  const { prompt, answer, costTemplates, techniqueStep } = params;

  return {
    ...question,
    id: createQuestionId([question.type, prompt, answer]),
    prompt,
    answer,
    mentalCost: calculateMentalCost(costTemplates),
    costTemplates,
    tags: uniqueTags([...question.tags, ...(params.tags ?? []), "working-memory"]),
    technique: {
      name: "多步心算",
      steps: [...question.technique.steps, techniqueStep],
    },
    options: rebuildOptions(answer, question.kind, question.options),
  };
}

function rebuildOptions(
  answer: string,
  kind: QuestionKind,
  previousOptions?: string[],
): string[] | undefined {
  if (kind === "fill-in") {
    return undefined;
  }

  const numeric = parseNumericAnswer(answer);
  if (numeric === undefined) {
    return previousOptions;
  }

  const pool = [
    answer,
    String(numeric + 1),
    String(numeric - 1),
    String(numeric + 10),
    String(numeric - 10),
  ];
  const unique = [...new Set(pool)];
  return shuffle(unique).slice(0, Math.min(4, unique.length));
}

type AppendBuilder = () => Question | undefined;

function pickAppendCandidate(question: Question, builders: AppendBuilder[]): Question | undefined {
  for (const build of shuffle(builders)) {
    const candidate = build();
    if (candidate && candidate.mentalCost > question.mentalCost) {
      return candidate;
    }
  }
  return undefined;
}

function appendIntegerOperation(question: Question, currentValue: number): Question | undefined {
  if (!Number.isInteger(currentValue)) {
    return undefined;
  }

  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];
  const { min, max } = operandRange(question.difficulty);

  const builders: AppendBuilder[] = [
    () => {
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
    () => {
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
    () => {
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
    () => {
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
  ];

  return pickAppendCandidate(question, builders);
}

function appendFractionOperation(question: Question, left: Fraction): Question | undefined {
  const baseExpr = stripPromptSuffix(question.prompt);
  const existing = question.costTemplates ?? [];
  const right = randomProperFraction(question.difficulty);
  const op = pickOne(["+", "−", "×", "÷"] as const);

  let result: Fraction;
  let template: CalculationTemplateSpec;
  let prompt: string;
  let techniqueStep: string;
  let tags: string[];

  switch (op) {
    case "+":
      result = simplifyFraction({ num: left.num * right.den + right.num * left.den, den: left.den * right.den });
      template = { kind: "fraction-unlike-denom", left, right };
      prompt = `${baseExpr} + ${formatFraction(right)} = ?`;
      techniqueStep = `${formatFraction(left)} + ${formatFraction(right)} = ${formatFraction(result)}`;
      tags = ["addition"];
      break;
    case "−":
      result = simplifyFraction({ num: left.num * right.den - right.num * left.den, den: left.den * right.den });
      if (result.num <= 0) {
        return undefined;
      }
      template = { kind: "fraction-unlike-denom", left, right };
      prompt = `${baseExpr} − ${formatFraction(right)} = ?`;
      techniqueStep = `${formatFraction(left)} − ${formatFraction(right)} = ${formatFraction(result)}`;
      tags = ["subtraction"];
      break;
    case "×":
      result = simplifyFraction({ num: left.num * right.num, den: left.den * right.den });
      template = { kind: "fraction-multiply", left, right };
      prompt = `${baseExpr} × ${formatFraction(right)} = ?`;
      techniqueStep = `${formatFraction(left)} × ${formatFraction(right)} = ${formatFraction(result)}`;
      tags = ["multiplication"];
      break;
    case "÷":
      if (right.num === 0) {
        return undefined;
      }
      result = simplifyFraction({ num: left.num * right.den, den: left.den * right.num });
      template = { kind: "fraction-divide", left, right };
      prompt = `${baseExpr} ÷ ${formatFraction(right)} = ?`;
      techniqueStep = `${formatFraction(left)} ÷ ${formatFraction(right)} = ${formatFraction(result)}`;
      tags = ["division"];
      break;
  }

  const answer = formatFraction(result);
  if (answer.includes("/0")) {
    return undefined;
  }

  return rebuildQuestion(question, {
    prompt,
    answer,
    costTemplates: [...existing, template],
    tags,
    techniqueStep,
  });
}

export function appendArithmeticStep(question: Question): Question | undefined {
  const value = parseNumericAnswer(question.answer);
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return appendIntegerOperation(question, value);
}

export function appendPowersStep(question: Question): Question | undefined {
  const value = parseNumericAnswer(question.answer);
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return appendIntegerOperation(question, value);
}

export function appendFractionStep(question: Question): Question | undefined {
  const left = parseFractionAnswer(question.answer);
  if (!left) {
    return undefined;
  }
  return appendFractionOperation(question, left);
}

export function appendCostStep(question: Question): Question | undefined {
  switch (question.type) {
    case "arithmetic":
      return appendArithmeticStep(question);
    case "powers":
      return appendPowersStep(question);
    case "fractions":
      return appendFractionStep(question);
    default:
      return undefined;
  }
}
