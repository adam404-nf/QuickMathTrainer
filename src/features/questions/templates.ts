import {
  buildFractionAbsComposite,
  buildFractionComposite,
  formatFraction,
  fractionDivideTechnique,
  fractionMultiplyTechnique,
  lcm,
  randomFractionPair,
  randomProperFraction,
  unlikeDenominatorTechnique,
} from "./fractionMath";
import { calculateMentalCost, type CalculationTemplateSpec } from "./calculationTemplates";
import type { QuestionTechnique } from "./types";
import type { Difficulty, MentalCost, Question, QuestionKind, QuestionType } from "./types";
import {
  additionTechnique,
  cubeRootTechnique,
  cubeTechnique,
  decimalAddTechnique,
  decimalConversionTechnique,
  decimalMultiplyTechnique,
  decimalSubtractTechnique,
  differenceOfSquaresTechnique,
  divisionTechnique,
  doubleAbsTechnique,
  fourthPowerTechnique,
  fourthRootTechnique,
  integerAbsCompositeTechnique,
  multiplicationTechnique,
  multiplyThenAddTechnique,
  parenthesesMultiplyTechnique,
  powersAbsCompositeTechnique,
  sameDenominatorAddTechnique,
  sqrtSignedSquareTechnique,
  squareRootTechnique,
  squareTechnique,
  sumDiffProductTechnique,
  symbolicAbsTechnique,
} from "./techniques";
import { createQuestionId, parseNumericAnswer, pickOne, randomInt, shuffle } from "./utils";

export interface QuestionTemplateInput {
  difficulty: Difficulty;
  kind: QuestionKind;
}

export type QuestionTemplate = (input: QuestionTemplateInput) => Question;

function withOptions(answer: string, distractors: readonly string[], kind: QuestionKind): string[] | undefined {
  if (kind === "fill-in") {
    return undefined;
  }

  const pool = [...new Set(distractors.filter((item) => item !== answer))];
  const numericAnswer = parseNumericAnswer(answer);

  if (numericAnswer !== undefined) {
    for (let offset = 1; pool.length < 3 && offset <= 20; offset += 1) {
      for (const candidate of [numericAnswer + offset, numericAnswer - offset]) {
        const formatted = String(candidate);
        if (formatted !== answer && !pool.includes(formatted)) {
          pool.push(formatted);
        }
        if (pool.length >= 3) {
          break;
        }
      }
    }
  }

  const selectedDistractors = shuffle(pool).slice(0, 3);
  return shuffle([answer, ...selectedDistractors]);
}

function makeQuestion(params: {
  type: QuestionType;
  prompt: string;
  answer: string;
  difficulty: Difficulty;
  tags: string[];
  mentalCost: MentalCost;
  technique: QuestionTechnique;
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
    technique: params.technique,
  };
}

function mc(...templates: CalculationTemplateSpec[]): MentalCost {
  return calculateMentalCost(templates);
}

function formatDecimal(value: number): string {
  return String(Number(value.toFixed(4)));
}

function unlikeDenominatorQuestion(
  difficulty: Difficulty,
  kind: QuestionKind,
  op: "+" | "−",
  tag: "addition" | "subtraction",
): Question {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pair = randomFractionPair(difficulty);
    if (!pair) continue;
    const [left, right] = pair;
    const common = lcm(left.den, right.den);
    const template: CalculationTemplateSpec = { kind: "fraction-unlike-denom", left, right };
    const mentalCost = mc(template);
    if (mentalCost === 1) continue;

    const leftNum = left.num * (common / left.den);
    const rightNum = right.num * (common / right.den);
    const resultNum = op === "+" ? leftNum + rightNum : leftNum - rightNum;
    const answer = formatFraction({ num: resultNum, den: common });
    const opSymbol = op === "+" ? "+" : "−";

    return makeQuestion({
      type: "fractions",
      prompt: `${formatFraction(left)} ${opSymbol} ${formatFraction(right)} = ?`,
      answer,
      difficulty,
      tags: ["fractions", tag],
      mentalCost,
      technique: unlikeDenominatorTechnique(left, right, op),
      kind,
      distractors: [
        formatFraction({ num: resultNum + 1, den: common }),
        formatFraction({ num: resultNum, den: common + 1 }),
        formatFraction({ num: Math.max(1, resultNum - 1), den: common }),
        formatFraction({ num: resultNum, den: common * 2 }),
      ],
    });
  }

  const denominator = pickOne([4, 6, 8]);
  const leftNumerator = 1;
  const rightNumerator = 2;
  return makeQuestion({
    type: "fractions",
    prompt: `${leftNumerator}/${denominator} + ${rightNumerator}/${denominator} = ?`,
    answer: `${leftNumerator + rightNumerator}/${denominator}`,
    difficulty,
    tags: ["fractions", "addition"],
    mentalCost: mc({ kind: "fraction-same-denom", denominator }),
    technique: sameDenominatorAddTechnique(leftNumerator, rightNumerator, denominator),
    kind,
    distractors: [`${leftNumerator + rightNumerator + 1}/${denominator}`, `3/${denominator}`, `1/${denominator}`, `2/${denominator}`],
  });
}

function fractionBinaryQuestion(
  difficulty: Difficulty,
  kind: QuestionKind,
  op: "×" | "÷",
): Question {
  const left = randomProperFraction(difficulty);
  const right = randomProperFraction(difficulty);
  const answer =
    op === "×"
      ? formatFraction({ num: left.num * right.num, den: left.den * right.den })
      : formatFraction({ num: left.num * right.den, den: left.den * right.num });
  const technique =
    op === "×" ? fractionMultiplyTechnique(left, right) : fractionDivideTechnique(left, right);
  const template: CalculationTemplateSpec =
    op === "×"
      ? { kind: "fraction-multiply", left, right }
      : { kind: "fraction-divide", left, right };

  return makeQuestion({
    type: "fractions",
    prompt: `${formatFraction(left)} ${op} ${formatFraction(right)} = ?`,
    answer,
    difficulty,
    tags: ["fractions", op === "×" ? "multiplication" : "division"],
    mentalCost: mc(template),
    technique,
    kind,
    distractors: [answer, formatFraction({ num: left.num + right.num, den: left.den }), "1/2", "2/3"],
  });
}

function compositeFractionTemplate(stepCount: 2 | 3): QuestionTemplate {
  return ({ difficulty, kind }) => {
    const built = buildFractionComposite(difficulty, stepCount);
    if (!built) {
      return unlikeDenominatorQuestion(difficulty, kind, "+", "addition");
    }

    return makeQuestion({
      type: "fractions",
      prompt: built.prompt,
      answer: built.answer,
      difficulty,
      tags: built.tags,
      mentalCost: calculateMentalCost(built.calculationTemplates),
      technique: built.technique,
      kind,
      distractors: [built.answer, "1/2", "2/3", "3/4"],
    });
  };
}

function fractionAbsTemplate(withOuterOp: boolean): QuestionTemplate {
  return ({ difficulty, kind }) => {
    const built = buildFractionAbsComposite(difficulty, withOuterOp);
    if (!built) {
      return unlikeDenominatorQuestion(difficulty, kind, "−", "subtraction");
    }

    return makeQuestion({
      type: "fractions",
      prompt: built.prompt,
      answer: built.answer,
      difficulty,
      tags: built.tags,
      mentalCost: calculateMentalCost(built.calculationTemplates),
      technique: built.technique,
      kind,
      distractors: [built.answer, "1/6", "1/4", "1/3"],
    });
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
      tags: ["multiplication"],
      mentalCost: mc({ kind: "integer-multiply", a: base, b: partner }),
      technique: multiplicationTechnique(base, partner),
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
      mentalCost: mc({ kind: "integer-add", a: left, b: right }),
      technique: additionTechnique(left, right),
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
      mentalCost: mc({ kind: "integer-divide", dividend, divisor }),
      technique: divisionTechnique(dividend, divisor, answer),
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
      mentalCost: mc(
        { kind: "integer-add", a, b },
        { kind: "integer-multiply", a: a + b, b: c },
      ),
      technique: parenthesesMultiplyTechnique(a, b, c, answer),
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
      mentalCost: mc(
        { kind: "integer-multiply", a, b },
        { kind: "integer-add", a: a * b, b: c },
      ),
      technique: multiplyThenAddTechnique(a, b, c, answer),
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
      mentalCost: mc(
        { kind: "square", n: a },
        { kind: "square", n: b },
        { kind: "integer-subtract", a: a * a, b: b * b },
      ),
      technique: differenceOfSquaresTechnique(a, b),
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
      mentalCost: mc(
        { kind: "integer-add", a, b },
        { kind: "integer-subtract", a, b },
        { kind: "integer-multiply", a: a + b, b: a - b },
      ),
      technique: sumDiffProductTechnique(a, b),
      kind,
      distractors: [a * a + b * b, a * a - b * b + 1, (a + b) + (a - b), answer + b].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = -randomInt(3, difficulty === "hard" ? 15 : 10);
    const b = randomInt(2, 9);
    const c = randomInt(2, difficulty === "hard" ? 9 : 6);
    const answer = Math.abs(a) + b * c;
    const prompt = `|${a}| + ${b} × ${c} = ?`;

    return makeQuestion({
      type: "arithmetic",
      prompt,
      answer: String(answer),
      difficulty,
      tags: ["absolute-value", "order-of-operations", "working-memory", "multiplication"],
      mentalCost: mc(
        { kind: "absolute-value" },
        { kind: "integer-multiply", a: b, b: c },
        { kind: "integer-add", a: Math.abs(a), b: b * c },
      ),
      technique: integerAbsCompositeTechnique(a, b, c, prompt, answer),
      kind,
      distractors: [answer + 1, answer - 1, Math.abs(a) + b + c, b * c].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = -randomInt(4, 12);
    const b = -randomInt(2, 8);
    const answer = Math.abs(a) - Math.abs(b);

    return makeQuestion({
      type: "arithmetic",
      prompt: `|${a}| − |${b}| = ?`,
      answer: String(answer),
      difficulty,
      tags: ["absolute-value", "subtraction", "working-memory"],
      mentalCost: mc(
        { kind: "absolute-value" },
        { kind: "absolute-value" },
        { kind: "integer-subtract", a: Math.abs(a), b: Math.abs(b) },
      ),
      technique: doubleAbsTechnique(a, b, answer),
      kind,
      distractors: [answer + 1, answer - 1, Math.abs(a) + Math.abs(b), Math.abs(a)].map(String),
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
      mentalCost: mc({ kind: "square", n: value }),
      technique: squareTechnique(value),
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
      mentalCost: mc({ kind: "square-root", radicand }),
      technique: squareRootTechnique(root, radicand),
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const base = randomInt(2, difficulty === "hard" ? 6 : 5);
    const answer = base ** 3;

    return makeQuestion({
      type: "powers",
      prompt: `${base}³ = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "working-memory"],
      mentalCost: mc({ kind: "cube", n: base }),
      technique: cubeTechnique(base),
      kind,
      distractors: [answer + base, answer - base, base ** 2, answer + 3].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const base = randomInt(2, difficulty === "hard" ? 5 : 4);
    const answer = base ** 4;

    return makeQuestion({
      type: "powers",
      prompt: `${base}⁴ = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "working-memory"],
      mentalCost: mc({ kind: "fourth-power", n: base }),
      technique: fourthPowerTechnique(base),
      kind,
      distractors: [answer + base, answer - base, base ** 3, answer + 4].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const root = randomInt(2, difficulty === "hard" ? 6 : 5);
    const radicand = root ** 3;

    return makeQuestion({
      type: "powers",
      prompt: `∛${radicand} = ?`,
      answer: String(root),
      difficulty,
      tags: ["cube-root", "working-memory"],
      mentalCost: mc({ kind: "cube-root", root }),
      technique: cubeRootTechnique(root, radicand),
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const root = randomInt(2, difficulty === "hard" ? 4 : 4);
    const radicand = root ** 4;

    return makeQuestion({
      type: "powers",
      prompt: `⁴√${radicand} = ?`,
      answer: String(root),
      difficulty,
      tags: ["fourth-root", "working-memory"],
      mentalCost: mc({ kind: "fourth-root", root }),
      technique: fourthRootTechnique(root, radicand),
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const value = randomInt(3, difficulty === "hard" ? 15 : 11);
    const signed = pickOne([-value, value]);
    const answer = Math.abs(signed);
    const radicand = signed * signed;

    return makeQuestion({
      type: "powers",
      prompt: `√((${signed})²) = ?`,
      answer: String(answer),
      difficulty,
      tags: ["square-root", "absolute-value"],
      mentalCost: mc({ kind: "square-root", radicand }, { kind: "absolute-value" }),
      technique: sqrtSignedSquareTechnique(signed, answer),
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
      mentalCost: mc({ kind: "symbolic-simplify" }),
      technique: symbolicAbsTechnique(variable),
      kind,
      distractors: [variable, `-${variable}`, `${variable}²`, `±${variable}`],
    });
  },
  ({ difficulty, kind }) => {
    const a = -randomInt(2, difficulty === "hard" ? 9 : 7);
    const answer = Math.abs(a) ** 2;

    return makeQuestion({
      type: "powers",
      prompt: `|${a}|² = ?`,
      answer: String(answer),
      difficulty,
      tags: ["absolute-value", "multiplication"],
      mentalCost: mc({ kind: "absolute-value" }, { kind: "square", n: Math.abs(a) }),
      technique: powersAbsCompositeTechnique(a, answer, true),
      kind,
      distractors: [answer + 1, answer - 1, Math.abs(a), a * a].map(String),
    });
  },
  ({ difficulty, kind }) => {
    const a = -randomInt(2, 8);
    const b = randomInt(1, 6);
    const answer = Math.abs(a) + b;

    return makeQuestion({
      type: "powers",
      prompt: `|${a}| + ${b} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["absolute-value", "addition"],
      mentalCost: mc({ kind: "absolute-value" }, { kind: "integer-add", a: Math.abs(a), b }),
      technique: powersAbsCompositeTechnique(a, answer, false),
      kind,
      distractors: [answer + 1, answer - 1, a + b, Math.abs(a) - b].map(String),
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
      tags: ["fractions", "addition"],
      mentalCost: mc({ kind: "fraction-same-denom", denominator }),
      technique: sameDenominatorAddTechnique(leftNumerator, rightNumerator, denominator),
      kind,
      distractors: [
        `${answerNumerator + 1}/${denominator}`,
        `${answerNumerator}/${denominator + 1}`,
        `${Math.max(1, answerNumerator - 1)}/${denominator}`,
        `${answerNumerator}/${denominator * 2}`,
      ],
    });
  },
  ({ difficulty, kind }) => unlikeDenominatorQuestion(difficulty, kind, "+", "addition"),
  ({ difficulty, kind }) => unlikeDenominatorQuestion(difficulty, kind, "−", "subtraction"),
  ({ difficulty, kind }) => fractionBinaryQuestion(difficulty, kind, "×"),
  ({ difficulty, kind }) => fractionBinaryQuestion(difficulty, kind, "÷"),
  compositeFractionTemplate(2),
  compositeFractionTemplate(3),
  fractionAbsTemplate(false),
  fractionAbsTemplate(true),
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
      mentalCost: mc({ kind: "fraction-to-decimal", denominator }),
      technique: decimalConversionTechnique(numerator, denominator, answer),
      kind,
      distractors: [answer + 0.1, answer - 0.1, answer + 0.01, Math.max(0, answer - 0.01)].map((item) =>
        item.toFixed(2),
      ),
    });
  },
  ({ difficulty, kind }) => {
    const left = pickOne([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const right = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
    const answer = left + right;

    return makeQuestion({
      type: "fractions",
      prompt: `${formatDecimal(left)} + ${formatDecimal(right)} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "addition"],
      mentalCost: mc({ kind: "decimal-add", left, right }),
      technique: decimalAddTechnique(left, right, answer),
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
      mentalCost: mc({ kind: "decimal-multiply", decimal: left, integer: right }),
      technique: decimalMultiplyTechnique(left, right, answer),
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
      mentalCost: mc({ kind: "decimal-subtract", whole, fraction }),
      technique: decimalSubtractTechnique(whole, fraction, answer),
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
