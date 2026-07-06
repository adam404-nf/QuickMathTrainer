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

export function getAnswerFormatHint(expectedAnswer: string): string {
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

export function isAnswerCorrect(userAnswer: string, expectedAnswer: string): boolean {
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  const normalizedExpectedAnswer = normalizeAnswer(expectedAnswer);

  if (normalizedUserAnswer === normalizedExpectedAnswer) {
    return true;
  }

  if (isSymbolicAbsoluteAnswer(normalizedExpectedAnswer)) {
    return false;
  }

  const userNumeric = parseNumericAnswer(normalizedUserAnswer);
  const expectedNumeric = parseNumericAnswer(normalizedExpectedAnswer);

  if (userNumeric === undefined || expectedNumeric === undefined) {
    return false;
  }

  return Math.abs(userNumeric - expectedNumeric) < 0.000001;
}

export function createQuestionId(parts: readonly string[]): string {
  return parts.map(normalizeAnswer).join(":");
}

export function chooseQuestionKind(): QuestionKind {
  return Math.random() < 0.2 ? "multiple-choice" : "fill-in";
}
