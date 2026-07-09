import type { QuestionKind } from "./types";

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickOne<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty array.");
  }

  return items[randomInt(0, items.length - 1)];
}

export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty array.");
  }
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    throw new Error("Cannot pick from all-zero weights.");
  }
  let target = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    target -= weights[i];
    if (target <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

export function shuffle<T>(items: readonly T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, "").toLowerCase();
}

export function isSymbolicAbsoluteAnswer(answer: string): boolean {
  return /^\|[a-z]\|$/.test(normalizeAnswer(answer));
}

function isFractionAnswer(answer: string): boolean {
  return /^-?\d+\/-?\d+$/.test(normalizeAnswer(answer));
}

function isDecimalAnswer(answer: string): boolean {
  return normalizeAnswer(answer).includes(".");
}

export function getAnswerFormatHint(expectedAnswer: string, answerFormat?: "decimal" | "fraction"): string {
  if (answerFormat === "fraction") {
    return "請以最簡分數作答（例如 3/4）";
  }
  if (answerFormat === "decimal") {
    return "請輸入小數（例如 0.5）";
  }

  const trimmedAnswer = expectedAnswer.trim();

  if (isSymbolicAbsoluteAnswer(trimmedAnswer)) {
    return `請以絕對值形式作答（例如 ${trimmedAnswer}）`;
  }

  if (isFractionAnswer(trimmedAnswer)) {
    return "請以分數形式作答（例如 3/4）";
  }

  if (isDecimalAnswer(trimmedAnswer)) {
    return "請輸入小數（例如 0.5）";
  }

  return "請輸入整數";
}

export function parseNumericAnswer(answer: string): number | undefined {
  const normalized = normalizeAnswer(answer);
  const fractionMatch = normalized.match(/^(-?\d+)\/(-?\d+)$/);

  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    return denominator === 0 ? undefined : numerator / denominator;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function countSignificantDigits(answer: string): number {
  const normalized = normalizeAnswer(answer);
  const unsigned = normalized.startsWith("-") ? normalized.slice(1) : normalized;
  const digitsOnly = unsigned.replace(".", "");
  const trimmedLeadingZeros = digitsOnly.replace(/^0+/, "");
  return Math.max(1, trimmedLeadingZeros.length);
}

export function formatDecimal(value: number): string {
  return String(Number(value.toFixed(4)));
}

export function isAnswerCorrect(
  userAnswer: string,
  expectedAnswer: string,
  answerFormat?: "decimal" | "fraction",
): boolean {
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  const normalizedExpectedAnswer = normalizeAnswer(expectedAnswer);

  if (normalizedUserAnswer === normalizedExpectedAnswer) {
    if (answerFormat === "fraction") {
      return isSimplestFractionString(normalizedUserAnswer);
    }
    return true;
  }

  if (isSymbolicAbsoluteAnswer(normalizedExpectedAnswer)) {
    return false;
  }

  const format =
    answerFormat ??
    (isFractionAnswer(normalizedExpectedAnswer)
      ? "fraction"
      : isDecimalAnswer(normalizedExpectedAnswer)
        ? "decimal"
        : undefined);

  if (format === "fraction") {
    if (!isFractionAnswer(normalizedUserAnswer)) {
      return false;
    }
    return (
      isSimplestFractionString(normalizedUserAnswer) &&
      parseNumericAnswer(normalizedUserAnswer) === parseNumericAnswer(normalizedExpectedAnswer)
    );
  }

  if (format === "decimal") {
    if (!isDecimalAnswer(normalizedUserAnswer)) {
      return false;
    }
    const userNumeric = parseNumericAnswer(normalizedUserAnswer);
    const expectedNumeric = parseNumericAnswer(normalizedExpectedAnswer);
    if (userNumeric === undefined || expectedNumeric === undefined) {
      return false;
    }
    return formatDecimal(userNumeric) === formatDecimal(expectedNumeric);
  }

  const userNumeric = parseNumericAnswer(normalizedUserAnswer);
  const expectedNumeric = parseNumericAnswer(normalizedExpectedAnswer);

  if (userNumeric === undefined || expectedNumeric === undefined) {
    return false;
  }

  return Math.abs(userNumeric - expectedNumeric) < 0.000001;
}

function isSimplestFractionString(answer: string): boolean {
  const match = answer.match(/^(-?\d+)\/(-?\d+)$/);
  if (!match) {
    return false;
  }
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (den <= 0) {
    return false;
  }
  const gcd = (a: number, b: number): number => {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const temp = y;
      y = x % y;
      x = temp;
    }
    return x || 1;
  };
  return gcd(num, den) === 1;
}

export function createQuestionId(parts: readonly string[]): string {
  return parts.map(normalizeAnswer).join(":");
}

export function chooseQuestionKind(): QuestionKind {
  return Math.random() < 0.2 ? "multiple-choice" : "fill-in";
}
