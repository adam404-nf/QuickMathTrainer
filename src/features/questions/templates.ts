import type { Difficulty, MentalCost, Question, QuestionKind, QuestionType } from "./types";
import { createQuestionId, pickOne, randomInt, shuffle } from "./utils";

export interface QuestionTemplateInput {
  difficulty: Difficulty;
  kind: QuestionKind;
}

export type QuestionTemplate = (input: QuestionTemplateInput) => Question;

function withOptions(answer: string, distractors: readonly string[], kind: QuestionKind): string[] | undefined {
  if (kind === "fill-in") {
    return undefined;
  }

  return shuffle([answer, ...distractors]).slice(0, 4);
}

function makeQuestion(params: {
  type: QuestionType;
  prompt: string;
  answer: string;
  difficulty: Difficulty;
  tags: string[];
  mentalCost: MentalCost;
  strategy: string;
  kind: QuestionKind;
  distractors: readonly string[];
}): Question {
  return {
    id: createQuestionId([params.type, params.prompt, params.answer]),
    kind: params.kind,
    type: params.type,
    prompt: params.prompt,
    answer: params.answer,
    options: withOptions(params.answer, params.distractors, params.kind),
    difficulty: params.difficulty,
    tags: params.tags,
    mentalCost: params.mentalCost,
    strategy: params.strategy,
  };
}

export const arithmeticTemplates: readonly QuestionTemplate[] = [
  ({ difficulty, kind }) => {
    const base = difficulty === "easy" ? randomInt(11, 19) : randomInt(21, 49);
    const partner = difficulty === "hard" ? randomInt(12, 19) : randomInt(2, 9);
    const answer = base * partner;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${base} × ${partner} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "integer"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "拆分乘法並合併部分積。",
      kind,
      distractors: [answer + partner, answer - partner, answer + 10, answer - 10].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const left = randomInt(12, difficulty === "hard" ? 99 : 49);
    const right = randomInt(11, difficulty === "easy" ? 30 : 80);
    const answer = left + right;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${left} + ${right} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["addition", "integer"],
      mentalCost: difficulty === "easy" ? 1 : 2,
      strategy: "先湊整十再加剩餘數字。",
      kind,
      distractors: [answer + 1, answer - 1, answer + 10, answer - 10].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const answer = randomInt(8, difficulty === "hard" ? 36 : 24);
    const divisor = randomInt(2, difficulty === "easy" ? 9 : 12);
    const dividend = answer * divisor;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${dividend} ÷ ${divisor} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["division", "integer"],
      mentalCost: difficulty === "easy" ? 1 : 2,
      strategy: "用乘法反推商。",
      kind,
      distractors: [answer + 1, answer - 1, answer + divisor, answer - divisor].map(String),
    });
  },
];

export const powersTemplates: readonly QuestionTemplate[] = [
  ({ difficulty, kind }) => {
    const value = randomInt(6, difficulty === "hard" ? 25 : 15);
    const answer = value * value;

    return makeQuestion({
      type: "powers",
      prompt: `${value}² = ?`,
      answer: String(answer),
      difficulty,
      tags: ["square", "powers"],
      mentalCost: difficulty === "easy" ? 1 : 2,
      strategy: "記憶常用平方或用平方差展開。",
      kind,
      distractors: [answer + value, answer - value, answer + 10, answer - 10].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const root = randomInt(8, difficulty === "hard" ? 24 : 16);
    const radicand = root * root;

    return makeQuestion({
      type: "powers",
      prompt: `√${radicand} = ?`,
      answer: String(root),
      difficulty,
      tags: ["square-root", "powers"],
      mentalCost: difficulty === "easy" ? 1 : 2,
      strategy: "辨識常見完全平方數。",
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const base = randomInt(2, difficulty === "hard" ? 7 : 5);
    const exponent = randomInt(3, difficulty === "hard" ? 4 : 3);
    const answer = base ** exponent;

    return makeQuestion({
      type: "powers",
      prompt: `${base}^${exponent} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["exponent", "powers"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "連續乘法並保留中間結果。",
      kind,
      distractors: [answer + base, answer - base, base ** (exponent - 1), answer + exponent].map(String),
    });
  },
];

export const fractionTemplates: readonly QuestionTemplate[] = [
  ({ difficulty, kind }) => {
    const denominator = pickOne(difficulty === "hard" ? [6, 8, 10, 12] : [2, 3, 4, 5]);
    const leftNumerator = randomInt(1, denominator - 1);
    const rightNumerator = randomInt(1, denominator - leftNumerator);
    const answerNumerator = leftNumerator + rightNumerator;
    const answer = `${answerNumerator}/${denominator}`;

    return makeQuestion({
      type: "fractions",
      prompt: `${leftNumerator}/${denominator} + ${rightNumerator}/${denominator} = ?`,
      answer,
      difficulty,
      tags: ["fractions", "same-denominator"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "同分母相加時只加分子。",
      kind,
      distractors: [
        `${answerNumerator + 1}/${denominator}`,
        `${answerNumerator}/${denominator + 1}`,
        `${Math.max(1, answerNumerator - 1)}/${denominator}`,
        `${answerNumerator}/${denominator * 2}`,
      ],
    });
  },
  ({ difficulty, kind }) => {
    const denominator = pickOne(difficulty === "hard" ? [6, 8, 10, 12] : [4, 5, 8, 10]);
    const numerator = randomInt(1, denominator - 1);
    const answer = numerator / denominator;

    return makeQuestion({
      type: "fractions",
      prompt: `${numerator}/${denominator} = ? (小數)`,
      answer: String(answer),
      difficulty,
      tags: ["fractions", "decimals"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "轉成常見分數小數對照。",
      kind,
      distractors: [answer + 0.1, answer - 0.1, answer + 0.01, Math.max(0, answer - 0.01)].map((item) =>
        item.toFixed(2),
      ),
    });
  },
];
