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

function formatDecimal(value: number): string {
  return String(Number(value.toFixed(4)));
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
      tags: ["multiplication"],
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
      tags: ["addition"],
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
      tags: ["division"],
      mentalCost: difficulty === "easy" ? 1 : 2,
      strategy: "用乘法反推商。",
      kind,
      distractors: [answer + 1, answer - 1, answer + divisor, answer - divisor].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = randomInt(2, difficulty === "hard" ? 18 : 12);
    const b = randomInt(2, difficulty === "hard" ? 15 : 9);
    const c = randomInt(2, difficulty === "easy" ? 6 : 9);
    const answer = (a + b) * c;

    return makeQuestion({
      type: "arithmetic",
      prompt: `(${a} + ${b}) × ${c} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["addition", "multiplication", "order-of-operations", "working-memory"],
      mentalCost: difficulty === "hard" ? 4 : 3,
      strategy: "先算括號內加法，記住結果後再乘。",
      kind,
      distractors: [a + b + c, a * b * c, answer + c, answer - c].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = randomInt(3, difficulty === "hard" ? 12 : 9);
    const b = randomInt(2, difficulty === "hard" ? 9 : 7);
    const c = randomInt(5, difficulty === "easy" ? 20 : 40);
    const answer = a * b + c;

    return makeQuestion({
      type: "arithmetic",
      prompt: `(${a} × ${b}) + ${c} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "addition", "order-of-operations", "working-memory"],
      mentalCost: difficulty === "hard" ? 4 : 3,
      strategy: "先算乘法，記住積後再加。",
      kind,
      distractors: [a * (b + c), answer + 1, answer - 1, a + b + c].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = randomInt(4, difficulty === "hard" ? 14 : 11);
    const b = randomInt(2, difficulty === "hard" ? 10 : 7);
    const answer = a * a - b * b;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${a}² - ${b}² = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "subtraction", "working-memory"],
      mentalCost: difficulty === "hard" ? 4 : 3,
      strategy: "分別算兩個平方，記住後再相減。",
      kind,
      distractors: [(a - b) ** 2, a + b, answer + b, answer - b].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = randomInt(4, difficulty === "hard" ? 13 : 10);
    const b = randomInt(2, difficulty === "hard" ? 9 : 6);
    const answer = (a + b) * (a - b);

    return makeQuestion({
      type: "arithmetic",
      prompt: `(${a} + ${b})(${a} - ${b}) = ?`,
      answer: String(answer),
      difficulty,
      tags: ["addition", "subtraction", "multiplication", "working-memory"],
      mentalCost: difficulty === "hard" ? 4 : 3,
      strategy: "先算和與差，記住兩個結果再相乘。",
      kind,
      distractors: [a * a + b * b, a * a - b * b + 1, (a + b) + (a - b), answer + b].map(String),
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
      tags: ["multiplication"],
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
      tags: ["square-root"],
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
      tags: ["multiplication", "working-memory"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "連續乘法並保留中間結果。",
      kind,
      distractors: [answer + base, answer - base, base ** (exponent - 1), answer + exponent].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const value = randomInt(3, difficulty === "hard" ? 15 : 11);
    const signed = pickOne([-value, value]);
    const answer = Math.abs(signed);

    return makeQuestion({
      type: "powers",
      prompt: `√((${signed})²) = ?`,
      answer: String(answer),
      difficulty,
      tags: ["square-root", "absolute-value"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "先平方去掉符號，再開方得絕對值。",
      kind,
      distractors: [signed, -answer, answer + 1, answer - 1].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const variable = pickOne(["a", "x", "n"] as const);

    return makeQuestion({
      type: "powers",
      prompt: `√(${variable}²) = ?（以 |${variable}| 格式作答）`,
      answer: `|${variable}|`,
      difficulty,
      tags: ["square-root", "absolute-value", "symbolic-simplification"],
      mentalCost: difficulty === "hard" ? 4 : 3,
      strategy: "平方根要寫成絕對值，避免漏掉 | |。",
      kind,
      distractors: [variable, `-${variable}`, `${variable}²`, `±${variable}`],
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
      tags: ["fractions"],
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
  ({ difficulty, kind }) => {
    const left = pickOne([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    const right = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
    const answer = left + right;

    return makeQuestion({
      type: "fractions",
      prompt: `${formatDecimal(left)} + ${formatDecimal(right)} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "addition"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "對齊小數位後再相加。",
      kind,
      distractors: [answer + 0.1, answer - 0.1, answer + 1, Math.max(0, answer - 1)].map(formatDecimal),
    });
  },
  ({ difficulty, kind }) => {
    const left = pickOne([0.2, 0.3, 0.4, 0.5, 0.6, 0.8]);
    const right = randomInt(2, difficulty === "hard" ? 9 : 6);
    const answer = left * right;

    return makeQuestion({
      type: "fractions",
      prompt: `${formatDecimal(left)} × ${right} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "multiplication"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "先當整數相乘，再補回小數位。",
      kind,
      distractors: [answer + 0.2, answer - 0.2, answer + 1, Math.max(0, answer - 1)].map(formatDecimal),
    });
  },
  ({ difficulty, kind }) => {
    const whole = randomInt(1, difficulty === "hard" ? 9 : 6);
    const fraction = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
    const answer = whole - fraction;

    return makeQuestion({
      type: "fractions",
      prompt: `${whole} - ${formatDecimal(fraction)} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "subtraction"],
      mentalCost: difficulty === "easy" ? 2 : 3,
      strategy: "把整數借位後再減小數部分。",
      kind,
      distractors: [answer + 0.1, answer - 0.1, whole + fraction, Math.max(0, answer - 1)].map(formatDecimal),
    });
  },
];

export const allTemplates: readonly QuestionTemplate[] = [
  ...arithmeticTemplates,
  ...powersTemplates,
  ...fractionTemplates,
];

export function templateMatchesTags(template: QuestionTemplate, tags: readonly string[]): boolean {
  if (tags.length === 0) {
    return true;
  }

  const sample = template({ difficulty: "medium", kind: "fill-in" });
  return sample.tags.some((tag) => tags.includes(tag));
}

export function filterTemplates(
  templates: readonly QuestionTemplate[],
  tags?: readonly string[],
): QuestionTemplate[] {
  if (!tags || tags.length === 0) {
    return [...templates];
  }

  return templates.filter((template) => templateMatchesTags(template, tags));
}

export function getQuestionTypesForTags(tags: readonly string[]): QuestionType[] {
  const types = new Set<QuestionType>();

  for (const template of allTemplates) {
    if (!templateMatchesTags(template, tags)) {
      continue;
    }

    const sample = template({ difficulty: "medium", kind: "fill-in" });
    types.add(sample.type);
  }

  return [...types];
}
