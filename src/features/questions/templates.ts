import { deriveSpecialtyTags, formatDistractor } from "./answerPath";
import {
  buildFractionAbsComposite,
  buildFractionComposite,
  formatFraction,
  fractionDivideTechnique,
  fractionMultiplyTechnique,
  lcm,
  randomFractionPair,
  randomProperFraction,
  simplifyFraction,
  unlikeDenominatorTechnique,
} from "./fractionMath";
import { calculateMentalCost, type CalculationTemplateSpec } from "./calculationTemplates";
import type { QuestionTechnique } from "./types";
import type { Difficulty, Question, QuestionKind, QuestionType } from "./types";
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
  genericTechnique,
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
import { createQuestionId, formatDecimal, normalizeAnswer, parseNumericAnswer, pickOne, randomInt, shuffle } from "./utils";
import type { OperationKind, TemplateCategory } from "./selectionPolicy";

export interface QuestionTemplateInput {
  difficulty: Difficulty;
  kind: QuestionKind;
}

export type QuestionTemplateFn = (input: QuestionTemplateInput) => Question;

export interface QuestionTemplateDescriptor {
  id: string;
  category: TemplateCategory;
  /** 同題同類可控重複用的運算族鍵（細於六大分類） */
  operationKind: OperationKind;
  generate: QuestionTemplateFn;
}

export type QuestionTemplate = QuestionTemplateDescriptor;

function describeTemplate(
  id: string,
  category: TemplateCategory,
  operationKind: OperationKind,
  generate: QuestionTemplateFn,
): QuestionTemplateDescriptor {
  return {
    id,
    category,
    operationKind,
    generate: (input) => {
      const question = generate(input);
      return { ...question, templateId: id, templateCategory: category };
    },
  };
}

export function getTemplateCategory(template: QuestionTemplateDescriptor): TemplateCategory {
  return template.category;
}

function inferAnswerFormat(answer: string, explicit?: Question["answerFormat"]): Question["answerFormat"] | undefined {
  if (explicit) {
    return explicit;
  }
  const normalized = normalizeAnswer(answer);
  if (/^-?\d+\/-?\d+$/.test(normalized)) {
    return "fraction";
  }
  if (normalized.includes(".")) {
    return "decimal";
  }
  return undefined;
}

function withOptions(
  answer: string,
  distractors: readonly string[],
  kind: QuestionKind,
  answerFormat?: Question["answerFormat"],
): string[] | undefined {
  if (kind === "fill-in") {
    return undefined;
  }

  const format = inferAnswerFormat(answer, answerFormat);
  const pool = [...new Set(distractors.map((item) => formatDistractor(item, format)).filter((item) => item !== answer))];
  const numericAnswer = parseNumericAnswer(answer);

  if (numericAnswer !== undefined) {
    for (let offset = 1; pool.length < 3 && offset <= 20; offset += 1) {
      for (const candidate of [numericAnswer + offset * 0.1, numericAnswer - offset * 0.1, numericAnswer + offset, numericAnswer - offset]) {
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

  const selectedDistractors = shuffle(pool).slice(0, 3);
  return shuffle([answer, ...selectedDistractors]);
}

function makeQuestion(params: {
  type: QuestionType;
  prompt: string;
  answer: string;
  difficulty: Difficulty;
  tags: string[];
  specialtyTags?: string[];
  answerFormat?: Question["answerFormat"];
  needsAnswerPath?: boolean;
  rationalValue?: number;
  costTemplates: CalculationTemplateSpec[];
  technique: QuestionTechnique;
  kind: QuestionKind;
  distractors: readonly string[];
}): Question {
  const specialtyTags = params.specialtyTags ?? deriveSpecialtyTags(params.tags);
  return {
    id: createQuestionId([params.type, params.prompt, params.answer]),
    kind: params.kind,
    type: params.type,
    prompt: params.prompt,
    answer: params.answer,
    options: withOptions(params.answer, params.distractors, params.kind, params.answerFormat),
    difficulty: params.difficulty,
    tags: params.tags,
    specialtyTags,
    answerFormat: params.answerFormat,
    needsAnswerPath: params.needsAnswerPath,
    rationalValue: params.rationalValue,
    mentalCost: calculateMentalCost(params.costTemplates, params.answer),
    costTemplates: params.costTemplates,
    technique: params.technique,
  };
}

function ct(...templates: CalculationTemplateSpec[]): CalculationTemplateSpec[] {
  return templates;
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
    const costTemplates = ct(template);
    const leftNum = left.num * (common / left.den);
    const rightNum = right.num * (common / right.den);
    const resultNum = op === "+" ? leftNum + rightNum : leftNum - rightNum;
    const answer = formatFraction(simplifyFraction({ num: resultNum, den: common }));
    if (calculateMentalCost(costTemplates, answer) < 2) continue;
    const opSymbol = op === "+" ? "+" : "−";

    return makeQuestion({
      type: "fractions",
      prompt: `${formatFraction(left)} ${opSymbol} ${formatFraction(right)} = ?`,
      answer,
      difficulty,
      tags: ["fractions", tag],
      costTemplates,
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
    costTemplates: ct({ kind: "fraction-same-denom", denominator }),
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
      costTemplates: ct(template),
      technique,
    kind,
    distractors: [answer, formatFraction({ num: left.num + right.num, den: left.den }), "1/2", "2/3"],
  });
}

function compositeFractionTemplate(stepCount: 2 | 3): QuestionTemplateFn {
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
      costTemplates: [...built.calculationTemplates],
      technique: built.technique,
      kind,
      distractors: [built.answer, "1/2", "2/3", "3/4"],
    });
  };
}

function fractionAbsTemplate(withOuterOp: boolean): QuestionTemplateFn {
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
      costTemplates: [...built.calculationTemplates],
      technique: built.technique,
      kind,
      distractors: [built.answer, "1/6", "1/4", "1/3"],
    });
  };
}

export const arithmeticTemplates: readonly QuestionTemplateDescriptor[] = [
  describeTemplate("integer-multiply", "integer", "integer-multiply", ({ difficulty, kind }) => {
    const base = difficulty === "easy" ? randomInt(11, 19) : randomInt(21, 49);
    const partner = difficulty === "hard" ? randomInt(12, 19) : randomInt(2, 9);
    const answer = base * partner;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${base} × ${partner} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication"],
      costTemplates: ct({ kind: "integer-multiply", a: base, b: partner }),
      technique: multiplicationTechnique(base, partner),
      kind,
      distractors: [answer + partner, answer - partner, answer + 10, answer - 10].map(String),
    });
  }),
  describeTemplate("integer-add", "integer", "integer-add", ({ difficulty, kind }) => {
    const left = randomInt(12, difficulty === "hard" ? 99 : 49);
    const right = randomInt(11, difficulty === "easy" ? 30 : 80);
    const answer = left + right;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${left} + ${right} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["addition"],
      costTemplates: ct({ kind: "integer-add", a: left, b: right }),
      technique: additionTechnique(left, right),
      kind,
      distractors: [answer + 1, answer - 1, answer + 10, answer - 10].map(String),
    });
  }),
  describeTemplate("integer-divide", "integer", "integer-divide", ({ difficulty, kind }) => {
    const answer = randomInt(8, difficulty === "hard" ? 36 : 24);
    const divisor = randomInt(2, difficulty === "easy" ? 9 : 12);
    const dividend = answer * divisor;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${dividend} ÷ ${divisor} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["division"],
      costTemplates: ct({ kind: "integer-divide", dividend, divisor }),
      technique: divisionTechnique(dividend, divisor, answer),
      kind,
      distractors: [answer + 1, answer - 1, answer + divisor, answer - divisor].map(String),
    });
  }),
  describeTemplate("integer-parentheses-multiply", "integer", "integer-parentheses-multiply", ({ difficulty, kind }) => {
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
      costTemplates: ct(
        { kind: "integer-add", a, b },
        { kind: "integer-multiply", a: a + b, b: c },
      ),
      technique: parenthesesMultiplyTechnique(a, b, c, answer),
      kind,
      distractors: [a + b + c, a * b * c, answer + c, answer - c].map(String),
    });
  }),
  describeTemplate("integer-multiply-then-add", "integer", "integer-multiply-then-add", ({ difficulty, kind }) => {
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
      costTemplates: ct(
        { kind: "integer-multiply", a, b },
        { kind: "integer-add", a: a * b, b: c },
      ),
      technique: multiplyThenAddTechnique(a, b, c, answer),
      kind,
      distractors: [a * (b + c), answer + 1, answer - 1, a + b + c].map(String),
    });
  }),
  describeTemplate("difference-of-squares", "integer", "difference-of-squares", ({ difficulty, kind }) => {
    const a = randomInt(4, difficulty === "hard" ? 14 : 11);
    const b = randomInt(2, difficulty === "hard" ? 10 : 7);
    const answer = a * a - b * b;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${a}² - ${b}² = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "subtraction", "working-memory"],
      costTemplates: ct(
        { kind: "square", n: a },
        { kind: "square", n: b },
        { kind: "integer-subtract", a: a * a, b: b * b },
      ),
      technique: differenceOfSquaresTechnique(a, b),
      kind,
      distractors: [(a - b) ** 2, a + b, answer + b, answer - b].map(String),
    });
  }),
  describeTemplate("sum-diff-product", "integer", "sum-diff-product", ({ difficulty, kind }) => {
    const a = randomInt(4, difficulty === "hard" ? 13 : 10);
    const b = randomInt(2, difficulty === "hard" ? 9 : 6);
    const answer = (a + b) * (a - b);

    return makeQuestion({
      type: "arithmetic",
      prompt: `(${a} + ${b})(${a} - ${b}) = ?`,
      answer: String(answer),
      difficulty,
      tags: ["addition", "subtraction", "multiplication", "working-memory"],
      costTemplates: ct(
        { kind: "integer-add", a, b },
        { kind: "integer-subtract", a, b },
        { kind: "integer-multiply", a: a + b, b: a - b },
      ),
      technique: sumDiffProductTechnique(a, b),
      kind,
      distractors: [a * a + b * b, a * a - b * b + 1, (a + b) + (a - b), answer + b].map(String),
    });
  }),
  describeTemplate("integer-abs-composite", "integer", "integer-abs-composite", ({ difficulty, kind }) => {
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
      costTemplates: ct(
        { kind: "absolute-value" },
        { kind: "integer-multiply", a: b, b: c },
        { kind: "integer-add", a: Math.abs(a), b: b * c },
      ),
      technique: integerAbsCompositeTechnique(a, b, c, prompt, answer),
      kind,
      distractors: [answer + 1, answer - 1, Math.abs(a) + b + c, b * c].map(String),
    });
  }),
  describeTemplate("double-abs", "integer", "double-abs", ({ difficulty, kind }) => {
    const a = -randomInt(4, 12);
    const b = -randomInt(2, 8);
    const answer = Math.abs(a) - Math.abs(b);

    return makeQuestion({
      type: "arithmetic",
      prompt: `|${a}| − |${b}| = ?`,
      answer: String(answer),
      difficulty,
      tags: ["absolute-value", "subtraction", "working-memory"],
      costTemplates: ct(
        { kind: "absolute-value" },
        { kind: "absolute-value" },
        { kind: "integer-subtract", a: Math.abs(a), b: Math.abs(b) },
      ),
      technique: doubleAbsTechnique(a, b, answer),
      kind,
      distractors: [answer + 1, answer - 1, Math.abs(a) + Math.abs(b), Math.abs(a)].map(String),
    });
  }),
  describeTemplate("integer-subtract", "integer", "integer-subtract", ({ difficulty, kind }) => {
    const left = randomInt(20, difficulty === "hard" ? 99 : 49);
    const right = randomInt(1, left - 1);
    const answer = left - right;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${left} − ${right} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["subtraction"],
      specialtyTags: ["subtraction"],
      costTemplates: ct({ kind: "integer-subtract", a: left, b: right }),
      technique: genericTechnique("整數減法", [`${left} − ${right} = ${answer}`]),
      kind,
      distractors: [answer + 1, answer - 1, answer + right, left + right].map(String),
    });
  }),
  describeTemplate("integer-subtract-chain", "integer", "integer-subtract-chain", ({ difficulty, kind }) => {
    const a = randomInt(30, difficulty === "hard" ? 99 : 60);
    const b = randomInt(5, 20);
    const c = randomInt(2, Math.min(15, b));
    const answer = a - b - c;

    return makeQuestion({
      type: "arithmetic",
      prompt: `${a} − ${b} − ${c} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["subtraction", "working-memory"],
      specialtyTags: ["subtraction"],
      costTemplates: ct(
        { kind: "integer-subtract", a, b },
        { kind: "integer-subtract", a: a - b, b: c },
      ),
      technique: genericTechnique("連續減法", [`${a} − ${b} = ${a - b}`, `${a - b} − ${c} = ${answer}`]),
      kind,
      distractors: [answer + 1, answer - 1, a - b, a - c].map(String),
    });
  }),
];

/**
 * 多步冪次複合題：以「先平方（或立方）再加減」的多步結構，配合多步驟協調成本
 * （見 costModel.calculateQuestionCost），讓 powers 題型也能達到與其他題型相同的
 * 統一難度 cost range。
 */
const squarePlusIntTemplate = describeTemplate("square-plus-int", "power", "square-plus-int", ({ difficulty, kind }) => {
  const range = {
    easy: { aMin: 6, aMax: 10, cMin: 4, cMax: 45 },
    medium: { aMin: 11, aMax: 15, cMin: 10, cMax: 60 },
    hard: { aMin: 13, aMax: 18, cMin: 20, cMax: 90 },
    extreme: { aMin: 16, aMax: 22, cMin: 35, cMax: 140 },
  }[difficulty];
  const a = randomInt(range.aMin, range.aMax);
  const c = randomInt(range.cMin, range.cMax);
  const op = pickOne(["+", "−"] as const);
  const square = a * a;
  const answer = op === "+" ? square + c : square - c;

  return makeQuestion({
    type: "powers",
    prompt: `${a}² ${op} ${c} = ?`,
    answer: String(answer),
    difficulty,
    tags: ["multiplication", "working-memory"],
    costTemplates: ct(
      { kind: "square", n: a },
      op === "+"
        ? { kind: "integer-add", a: square, b: c }
        : { kind: "integer-subtract", a: square, b: c },
    ),
    technique: genericTechnique("先平方再加減", [
      `${a}² = ${square}`,
      `${square} ${op} ${c} = ${answer}`,
    ]),
    kind,
    distractors: [answer + 1, answer - 1, answer + c, square].map(String),
  });
});

const twoSquaresTemplate = describeTemplate("two-squares", "power", "two-squares", ({ difficulty, kind }) => {
  const range = {
    easy: { min: 6, max: 10 },
    medium: { min: 8, max: 12 },
    hard: { min: 12, max: 19 },
    extreme: { min: 15, max: 22 },
  }[difficulty];
  let a = randomInt(range.min, range.max);
  let b = randomInt(range.min, range.max);
  const op = pickOne(["+", "−"] as const);
  if (op === "−" && b > a) {
    const swap = a;
    a = b;
    b = swap;
  }
  const squareA = a * a;
  const squareB = b * b;
  const answer = op === "+" ? squareA + squareB : squareA - squareB;

  return makeQuestion({
    type: "powers",
    prompt: `${a}² ${op} ${b}² = ?`,
    answer: String(answer),
    difficulty,
    tags: ["multiplication", "working-memory"],
    costTemplates: ct(
      { kind: "square", n: a },
      { kind: "square", n: b },
      op === "+"
        ? { kind: "integer-add", a: squareA, b: squareB }
        : { kind: "integer-subtract", a: squareA, b: squareB },
    ),
    technique: genericTechnique("先算兩個平方再合併", [
      `${a}² = ${squareA}，${b}² = ${squareB}`,
      `${squareA} ${op} ${squareB} = ${answer}`,
    ]),
    kind,
    distractors: [answer + 1, answer - 1, squareA, squareB].map(String),
  });
});

/**
 * 三步平方複合題 a² + b² − c²：三個 chunk，帶來 (3-1)×1 的協調成本，
 * 適合 hard 15–30 的上緣。
 */
const threeSquaresTemplate = describeTemplate("three-squares", "power", "three-squares", ({ difficulty, kind }) => {
  const range = {
    easy: { min: 5, max: 9 },
    medium: { min: 7, max: 11 },
    hard: { min: 9, max: 15 },
    extreme: { min: 12, max: 18 },
  }[difficulty];
  const a = randomInt(range.min, range.max);
  const b = randomInt(range.min, range.max);
  const c = randomInt(range.min, range.max);
  const squareA = a * a;
  const squareB = b * b;
  const squareC = c * c;
  const answer = squareA + squareB - squareC;

  return makeQuestion({
    type: "powers",
    prompt: `${a}² + ${b}² − ${c}² = ?`,
    answer: String(answer),
    difficulty,
    tags: ["multiplication", "working-memory"],
    costTemplates: ct(
      { kind: "square", n: a },
      { kind: "square", n: b },
      { kind: "square", n: c },
      { kind: "integer-add", a: squareA, b: squareB },
      { kind: "integer-subtract", a: squareA + squareB, b: squareC },
    ),
    technique: genericTechnique("先算三個平方再合併", [
      `${a}² = ${squareA}，${b}² = ${squareB}，${c}² = ${squareC}`,
      `${squareA} + ${squareB} − ${squareC} = ${answer}`,
    ]),
    kind,
    distractors: [answer + 1, answer - 1, squareA + squareB, squareC].map(String),
  });
});

/**
 * 立方複合題：easy/medium 用「a³ ± c」，hard 用「a³ ± b³」（多一個 chunk），
 * 讓 ³ 記憶提取題也能落在統一 range。
 */
const cubeComposite = describeTemplate("cube-composite", "power", "cube-composite", ({ difficulty, kind }) => {
  const op = pickOne(["+", "−"] as const);

  if (difficulty === "hard") {
    let a = randomInt(4, 8);
    let b = randomInt(2, 7);
    if (b > a) {
      const swap = a;
      a = b;
      b = swap;
    }
    const cubeA = a ** 3;
    const cubeB = b ** 3;
    const answer = op === "+" ? cubeA + cubeB : cubeA - cubeB;

    return makeQuestion({
      type: "powers",
      prompt: `${a}³ ${op} ${b}³ = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "working-memory"],
      costTemplates: ct(
        { kind: "cube", n: a },
        { kind: "cube", n: b },
        op === "+"
          ? { kind: "integer-add", a: cubeA, b: cubeB }
          : { kind: "integer-subtract", a: cubeA, b: cubeB },
      ),
      technique: genericTechnique("先算兩個立方再合併", [
        `${a}³ = ${cubeA}，${b}³ = ${cubeB}`,
        `${cubeA} ${op} ${cubeB} = ${answer}`,
      ]),
      kind,
      distractors: [answer + 1, answer - 1, cubeA, cubeB].map(String),
    });
  }

  const range = difficulty === "easy" ? { aMin: 3, aMax: 6, cMin: 5, cMax: 55 } : { aMin: 4, aMax: 7, cMin: 15, cMax: 90 };
  const a = randomInt(range.aMin, range.aMax);
  const cube = a ** 3;
  const c = randomInt(range.cMin, Math.min(range.cMax, cube - 1));
  const answer = op === "+" ? cube + c : cube - c;

  return makeQuestion({
    type: "powers",
    prompt: `${a}³ ${op} ${c} = ?`,
    answer: String(answer),
    difficulty,
    tags: ["multiplication", "working-memory"],
    costTemplates: ct(
      { kind: "cube", n: a },
      op === "+"
        ? { kind: "integer-add", a: cube, b: c }
        : { kind: "integer-subtract", a: cube, b: c },
    ),
    technique: genericTechnique("先立方再加減", [`${a}³ = ${cube}`, `${cube} ${op} ${c} = ${answer}`]),
    kind,
    distractors: [answer + 1, answer - 1, cube, answer + c].map(String),
  });
});

/**
 * 四次方複合題 a⁴ ± c：以較大的四次方 base 配合加減步驟達到統一 range。
 */
const fourthComposite = describeTemplate("fourth-composite", "power", "fourth-composite", ({ difficulty, kind }) => {
  const op = pickOne(["+", "−"] as const);
  const range = {
    easy: { aMin: 2, aMax: 4, cMin: 5, cMax: 40 },
    medium: { aMin: 2, aMax: 5, cMin: 10, cMax: 90 },
    hard: { aMin: 3, aMax: 5, cMin: 20, cMax: 90 },
    extreme: { aMin: 4, aMax: 6, cMin: 40, cMax: 180 },
  }[difficulty];
  const a = randomInt(range.aMin, range.aMax);
  const power = a ** 4;
  const c = randomInt(range.cMin, Math.min(range.cMax, power - 1));
  const answer = op === "+" ? power + c : power - c;

  return makeQuestion({
    type: "powers",
    prompt: `${a}⁴ ${op} ${c} = ?`,
    answer: String(answer),
    difficulty,
    tags: ["multiplication", "working-memory"],
    costTemplates: ct(
      { kind: "fourth-power", n: a },
      op === "+"
        ? { kind: "integer-add", a: power, b: c }
        : { kind: "integer-subtract", a: power, b: c },
    ),
    technique: genericTechnique("先算四次方再加減", [`${a}⁴ = ${power}`, `${power} ${op} ${c} = ${answer}`]),
    kind,
    distractors: [answer + 1, answer - 1, power, answer + c].map(String),
  });
});

/**
 * 立方根複合題：easy/medium 用「∛rad + c」，hard 用「∛rad + c + d」（多一步）。
 */
const cubeRootComposite = describeTemplate("cube-root-composite", "power", "cube-root-composite", ({ difficulty, kind }) => {
  const root = randomInt(3, 8);
  const radicand = root ** 3;

  if (difficulty === "hard") {
    const c = randomInt(11, 90);
    const d = randomInt(11, 90);
    const answer = root + c + d;

    return makeQuestion({
      type: "powers",
      prompt: `∛${radicand} + ${c} + ${d} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["cube-root", "working-memory", "addition"],
      specialtyTags: ["cube-root"],
      costTemplates: ct(
        { kind: "cube-root", root },
        { kind: "integer-add", a: root, b: c },
        { kind: "integer-add", a: root + c, b: d },
      ),
      technique: genericTechnique("先開立方根再連加", [
        `∛${radicand} = ${root}`,
        `${root} + ${c} + ${d} = ${answer}`,
      ]),
      kind,
      distractors: [answer + 1, answer - 1, root + c, root].map(String),
    });
  }

  const c = randomInt(11, difficulty === "medium" ? 90 : 55);
  const answer = root + c;

  return makeQuestion({
    type: "powers",
    prompt: `∛${radicand} + ${c} = ?`,
    answer: String(answer),
    difficulty,
    tags: ["cube-root", "working-memory", "addition"],
    specialtyTags: ["cube-root"],
    costTemplates: ct({ kind: "cube-root", root }, { kind: "integer-add", a: root, b: c }),
    technique: genericTechnique("先開立方根再相加", [`∛${radicand} = ${root}`, `${root} + ${c} = ${answer}`]),
    kind,
    distractors: [answer + 1, answer - 1, root, c].map(String),
  });
});

/**
 * 四次方根複合題：easy/medium 用「⁴√rad + c」，hard 用「⁴√rad + c + d」。
 */
const fourthRootComposite = describeTemplate("fourth-root-composite", "power", "fourth-root-composite", ({ difficulty, kind }) => {
  const root = randomInt(2, 5);
  const radicand = root ** 4;

  if (difficulty === "hard") {
    const c = randomInt(11, 90);
    const d = randomInt(11, 90);
    const answer = root + c + d;

    return makeQuestion({
      type: "powers",
      prompt: `⁴√${radicand} + ${c} + ${d} = ?`,
      answer: String(answer),
      difficulty,
      tags: ["fourth-root", "working-memory", "addition"],
      specialtyTags: ["fourth-root"],
      costTemplates: ct(
        { kind: "fourth-root", root },
        { kind: "integer-add", a: root, b: c },
        { kind: "integer-add", a: root + c, b: d },
      ),
      technique: genericTechnique("先開四次方根再連加", [
        `⁴√${radicand} = ${root}`,
        `${root} + ${c} + ${d} = ${answer}`,
      ]),
      kind,
      distractors: [answer + 1, answer - 1, root + c, root].map(String),
    });
  }

  const c = randomInt(11, difficulty === "medium" ? 90 : 55);
  const answer = root + c;

  return makeQuestion({
    type: "powers",
    prompt: `⁴√${radicand} + ${c} = ?`,
    answer: String(answer),
    difficulty,
    tags: ["fourth-root", "working-memory", "addition"],
    specialtyTags: ["fourth-root"],
    costTemplates: ct({ kind: "fourth-root", root }, { kind: "integer-add", a: root, b: c }),
    technique: genericTechnique("先開四次方根再相加", [`⁴√${radicand} = ${root}`, `${root} + ${c} = ${answer}`]),
    kind,
    distractors: [answer + 1, answer - 1, root, c].map(String),
  });
});

export const powersCompositeTemplates: readonly QuestionTemplateDescriptor[] = [
  squarePlusIntTemplate,
  twoSquaresTemplate,
  threeSquaresTemplate,
  cubeComposite,
  fourthComposite,
  cubeRootComposite,
  fourthRootComposite,
];

export const powersTemplates: readonly QuestionTemplateDescriptor[] = [
  describeTemplate("square", "power", "square", ({ difficulty, kind }) => {
    const value = randomInt(6, difficulty === "hard" ? 25 : 15);
    const answer = value * value;

    return makeQuestion({
      type: "powers",
      prompt: `${value}² = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication"],
      costTemplates: ct({ kind: "square", n: value }),
      technique: squareTechnique(value),
      kind,
      distractors: [answer + value, answer - value, answer + 10, answer - 10].map(String),
    });
  }),
  describeTemplate("square-root", "power", "square-root", ({ difficulty, kind }) => {
    const root = randomInt(8, difficulty === "hard" ? 24 : 16);
    const radicand = root * root;

    return makeQuestion({
      type: "powers",
      prompt: `√${radicand} = ?`,
      answer: String(root),
      difficulty,
      tags: ["square-root"],
      costTemplates: ct({ kind: "square-root", radicand }),
      technique: squareRootTechnique(root, radicand),
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  }),
  describeTemplate("cube", "power", "cube", ({ difficulty, kind }) => {
    const base = randomInt(2, difficulty === "hard" ? 6 : 5);
    const answer = base ** 3;

    return makeQuestion({
      type: "powers",
      prompt: `${base}³ = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "working-memory"],
      costTemplates: ct({ kind: "cube", n: base }),
      technique: cubeTechnique(base),
      kind,
      distractors: [answer + base, answer - base, base ** 2, answer + 3].map(String),
    });
  }),
  describeTemplate("fourth-power", "power", "fourth-power", ({ difficulty, kind }) => {
    const base = randomInt(2, difficulty === "hard" ? 5 : 4);
    const answer = base ** 4;

    return makeQuestion({
      type: "powers",
      prompt: `${base}⁴ = ?`,
      answer: String(answer),
      difficulty,
      tags: ["multiplication", "working-memory"],
      costTemplates: ct({ kind: "fourth-power", n: base }),
      technique: fourthPowerTechnique(base),
      kind,
      distractors: [answer + base, answer - base, base ** 3, answer + 4].map(String),
    });
  }),
  describeTemplate("cube-root", "power", "cube-root", ({ difficulty, kind }) => {
    const root = randomInt(2, difficulty === "hard" ? 6 : 5);
    const radicand = root ** 3;

    return makeQuestion({
      type: "powers",
      prompt: `∛${radicand} = ?`,
      answer: String(root),
      difficulty,
      tags: ["cube-root", "working-memory"],
      costTemplates: ct({ kind: "cube-root", root }),
      technique: cubeRootTechnique(root, radicand),
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  }),
  describeTemplate("fourth-root", "power", "fourth-root", ({ difficulty, kind }) => {
    const root = randomInt(2, difficulty === "hard" ? 4 : 4);
    const radicand = root ** 4;

    return makeQuestion({
      type: "powers",
      prompt: `⁴√${radicand} = ?`,
      answer: String(root),
      difficulty,
      tags: ["fourth-root", "working-memory"],
      costTemplates: ct({ kind: "fourth-root", root }),
      technique: fourthRootTechnique(root, radicand),
      kind,
      distractors: [root + 1, root - 1, root + 2, root - 2].map(String),
    });
  }),
  describeTemplate("sqrt-abs", "power", "sqrt-abs", ({ difficulty, kind }) => {
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
      costTemplates: ct({ kind: "square-root", radicand }, { kind: "absolute-value" }),
      technique: sqrtSignedSquareTechnique(signed, answer),
      kind,
      distractors: [signed, -answer, answer + 1, answer - 1].map(String),
    });
  }),
  describeTemplate("symbolic-abs", "power", "symbolic-abs", ({ difficulty, kind }) => {
    const variable = pickOne(["a", "x", "n"] as const);

    return makeQuestion({
      type: "powers",
      prompt: `√(${variable}²) = ?（以 |${variable}| 格式作答）`,
      answer: `|${variable}|`,
      difficulty,
      tags: ["square-root", "absolute-value", "symbolic-simplification"],
      costTemplates: ct({ kind: "symbolic-simplify" }),
      technique: symbolicAbsTechnique(variable),
      kind,
      distractors: [variable, `-${variable}`, `${variable}²`, `±${variable}`],
    });
  }),
  describeTemplate("abs-square", "power", "abs-square", ({ difficulty, kind }) => {
    const a = -randomInt(2, difficulty === "hard" ? 9 : 7);
    const answer = Math.abs(a) ** 2;

    return makeQuestion({
      type: "powers",
      prompt: `|${a}|² = ?`,
      answer: String(answer),
      difficulty,
      tags: ["absolute-value", "multiplication"],
      costTemplates: ct({ kind: "absolute-value" }, { kind: "square", n: Math.abs(a) }),
      technique: powersAbsCompositeTechnique(a, answer, true),
      kind,
      distractors: [answer + 1, answer - 1, Math.abs(a), a * a].map(String),
    });
  }),
  ...powersCompositeTemplates,
];

/**
 * 小數複合題 (a + b) × m：兩步小數運算配合協調成本，讓小數題也能落在統一 range，
 * 使 weakness-focused 的 decimals 練習不必因無法達標而退回整數題。
 */
const decimalCompositeTemplate = describeTemplate(
  "decimal-composite",
  "decimal",
  "decimal-composite",
  ({ difficulty, kind }) => {
  const mRange = {
    easy: { min: 3, max: 9 },
    medium: { min: 11, max: 29 },
    hard: { min: 20, max: 29 },
    extreme: { min: 24, max: 40 },
  }[difficulty];
  const left = randomInt(1, 9) / 10;
  const right = randomInt(1, 9) / 10;
  const multiplier = randomInt(mRange.min, mRange.max);
  const sum = Number((left + right).toFixed(1));
  const answer = Number((sum * multiplier).toFixed(2));

  return makeQuestion({
    type: "fractions",
    prompt: `(${formatDecimal(left)} + ${formatDecimal(right)}) × ${multiplier} = ?`,
    answer: formatDecimal(answer),
    difficulty,
    tags: ["decimals", "addition", "multiplication", "order-of-operations", "working-memory"],
    specialtyTags: ["decimals"],
    needsAnswerPath: true,
    rationalValue: answer,
    costTemplates: ct(
      { kind: "decimal-add", left, right },
      { kind: "decimal-multiply", decimal: sum, integer: multiplier },
    ),
    technique: genericTechnique("先算括號內小數加法再乘整數", [
      `${formatDecimal(left)} + ${formatDecimal(right)} = ${formatDecimal(sum)}`,
      `${formatDecimal(sum)} × ${multiplier} = ${formatDecimal(answer)}`,
    ]),
    kind,
    distractors: [answer + 0.1, answer - 0.1, answer + 1, Math.max(0, answer - 1)].map(formatDecimal),
  });
});

export const fractionTemplates: readonly QuestionTemplateDescriptor[] = [
  decimalCompositeTemplate,
  describeTemplate("fraction-same-denom-add", "fraction", "fraction-same-denom-add", ({ difficulty, kind }) => {
    const denominator = pickOne(difficulty === "hard" ? [6, 8, 10, 12] : [2, 3, 4, 5]);
    const leftNumerator = randomInt(1, denominator - 1);
    const rightNumerator = randomInt(1, denominator - leftNumerator);
    const answerNumerator = leftNumerator + rightNumerator;
    const answer = formatFraction(simplifyFraction({ num: answerNumerator, den: denominator }));

    return makeQuestion({
      type: "fractions",
      prompt: `${leftNumerator}/${denominator} + ${rightNumerator}/${denominator} = ?`,
      answer,
      difficulty,
      tags: ["fractions", "addition"],
      needsAnswerPath: true,
      rationalValue: answerNumerator / denominator,
      costTemplates: ct({ kind: "fraction-same-denom", denominator }),
      technique: sameDenominatorAddTechnique(leftNumerator, rightNumerator, denominator),
      kind,
      distractors: [
        `${answerNumerator + 1}/${denominator}`,
        `${answerNumerator}/${denominator + 1}`,
        `${Math.max(1, answerNumerator - 1)}/${denominator}`,
        `${answerNumerator}/${denominator * 2}`,
      ],
    });
  }),
  describeTemplate("fraction-unlike-add", "fraction", "fraction-unlike-add", ({ difficulty, kind }) =>
    unlikeDenominatorQuestion(difficulty, kind, "+", "addition"),
  ),
  describeTemplate("fraction-unlike-sub", "fraction", "fraction-unlike-sub", ({ difficulty, kind }) =>
    unlikeDenominatorQuestion(difficulty, kind, "−", "subtraction"),
  ),
  describeTemplate("fraction-multiply", "fraction", "fraction-multiply", ({ difficulty, kind }) =>
    fractionBinaryQuestion(difficulty, kind, "×"),
  ),
  describeTemplate("fraction-divide", "fraction", "fraction-divide", ({ difficulty, kind }) =>
    fractionBinaryQuestion(difficulty, kind, "÷"),
  ),
  describeTemplate("fraction-composite-2", "fraction", "fraction-composite-2", compositeFractionTemplate(2)),
  describeTemplate("fraction-composite-3", "fraction", "fraction-composite-3", compositeFractionTemplate(3)),
  describeTemplate("fraction-abs", "fraction", "fraction-abs", fractionAbsTemplate(false)),
  describeTemplate("fraction-abs-nested", "fraction", "fraction-abs-nested", fractionAbsTemplate(true)),
  describeTemplate("conversion-fraction-to-decimal", "conversion", "fraction-to-decimal", ({ difficulty, kind }) => {
    const denominator = pickOne(difficulty === "hard" ? [6, 8, 10, 12] : [4, 5, 8, 10]);
    const numerator = randomInt(1, denominator - 1);
    const value = numerator / denominator;

    return makeQuestion({
      type: "fractions",
      prompt: `${numerator}/${denominator} = ?`,
      answer: formatDecimal(value),
      difficulty,
      tags: ["fractions", "decimals"],
      specialtyTags: ["fractions", "decimals"],
      needsAnswerPath: true,
      rationalValue: value,
      costTemplates: ct({ kind: "fraction-same-denom", denominator }),
      technique: decimalConversionTechnique(numerator, denominator, value),
      kind,
      distractors: [value + 0.1, value - 0.1, value + 0.01, Math.max(0, value - 0.01)].map(formatDecimal),
    });
  }),
  describeTemplate("decimal-add", "decimal", "decimal-add", ({ difficulty, kind }) => {
    const left = pickOne([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const right = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
    const answer = left + right;

    return makeQuestion({
      type: "fractions",
      prompt: `${formatDecimal(left)} + ${formatDecimal(right)} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "addition"],
      needsAnswerPath: true,
      rationalValue: answer,
      costTemplates: ct({ kind: "decimal-add", left, right }),
      technique: decimalAddTechnique(left, right, answer),
      kind,
      distractors: [answer + 0.1, answer - 0.1, answer + 1, Math.max(0, answer - 1)].map(formatDecimal),
    });
  }),
  describeTemplate("decimal-multiply", "decimal", "decimal-multiply", ({ difficulty, kind }) => {
    const left = pickOne([0.2, 0.3, 0.4, 0.5, 0.6, 0.8]);
    const right = randomInt(2, difficulty === "hard" ? 9 : 6);
    const answer = left * right;

    return makeQuestion({
      type: "fractions",
      prompt: `${formatDecimal(left)} × ${right} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "multiplication"],
      needsAnswerPath: true,
      rationalValue: answer,
      costTemplates: ct({ kind: "decimal-multiply", decimal: left, integer: right }),
      technique: decimalMultiplyTechnique(left, right, answer),
      kind,
      distractors: [answer + 0.2, answer - 0.2, answer + 1, Math.max(0, answer - 1)].map(formatDecimal),
    });
  }),
  describeTemplate("decimal-subtract", "decimal", "decimal-subtract", ({ difficulty, kind }) => {
    const whole = randomInt(1, difficulty === "hard" ? 9 : 6);
    const fraction = pickOne([0.1, 0.2, 0.3, 0.4, 0.5]);
    const answer = whole - fraction;

    return makeQuestion({
      type: "fractions",
      prompt: `${whole} - ${formatDecimal(fraction)} = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "subtraction"],
      needsAnswerPath: true,
      rationalValue: answer,
      costTemplates: ct({ kind: "decimal-subtract", whole, fraction }),
      technique: decimalSubtractTechnique(whole, fraction, answer),
      kind,
      distractors: [answer + 0.1, answer - 0.1, whole + fraction, Math.max(0, answer - 1)].map(formatDecimal),
    });
  }),
  describeTemplate("mixed-decimal-fraction", "mixed-decimal-fraction", "decimal-fraction-mixed", ({ difficulty, kind }) => {
    const fraction = randomProperFraction(difficulty);
    const decimal = pickOne([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]);
    const op = pickOne(["+", "−", "×", "÷"] as const);
    const fracValue = fraction.num / fraction.den;
    let value: number;
    let costTemplate: CalculationTemplateSpec;
    let opTag: "addition" | "subtraction" | "multiplication" | "division";
    let prompt: string;

    switch (op) {
      case "+":
        value = fracValue + decimal;
        costTemplate = { kind: "decimal-fraction-add", decimal, fraction, op: "+" };
        opTag = "addition";
        prompt = `${formatFraction(fraction)} + ${formatDecimal(decimal)} = ?`;
        break;
      case "−":
        value = fracValue - decimal;
        if (value <= 0) {
          value = decimal - fracValue;
          prompt = `${formatDecimal(decimal)} − ${formatFraction(fraction)} = ?`;
        } else {
          prompt = `${formatFraction(fraction)} − ${formatDecimal(decimal)} = ?`;
        }
        costTemplate = { kind: "decimal-fraction-subtract", decimal, fraction, op: "−" };
        opTag = "subtraction";
        break;
      case "×":
        value = fracValue * decimal;
        costTemplate = { kind: "decimal-fraction-multiply", decimal, fraction, op: "×" };
        opTag = "multiplication";
        prompt = `${formatFraction(fraction)} × ${formatDecimal(decimal)} = ?`;
        break;
      default:
        if (fracValue === 0) {
          return unlikeDenominatorQuestion(difficulty, kind, "+", "addition");
        }
        value = decimal / fracValue;
        costTemplate = { kind: "decimal-fraction-divide", decimal, fraction, op: "÷" };
        opTag = "division";
        prompt = `${formatDecimal(decimal)} ÷ ${formatFraction(fraction)} = ?`;
        break;
    }

    return makeQuestion({
      type: "fractions",
      prompt,
      answer: formatDecimal(value),
      difficulty,
      tags: ["fractions", "decimals", opTag],
      specialtyTags: ["fractions", "decimals", opTag],
      needsAnswerPath: true,
      rationalValue: value,
      costTemplates: ct(costTemplate),
      technique: genericTechnique("小數與分數混合運算", [`${prompt.replace(" = ?", "")} = ${formatDecimal(value)}`]),
      kind,
      distractors: [value + 0.1, value - 0.1, value + 1, Math.max(0, value - 1)].map(formatDecimal),
    });
  }),
  describeTemplate("decimal-square", "decimal", "decimal-square", ({ difficulty, kind }) => {
    const decimal = pickOne([0.2, 0.3, 0.4, 0.5, 0.6, 0.8]);
    const answer = decimal * decimal;

    return makeQuestion({
      type: "fractions",
      prompt: `${formatDecimal(decimal)}² = ?`,
      answer: formatDecimal(answer),
      difficulty,
      tags: ["decimals", "multiplication"],
      specialtyTags: ["decimals", "multiplication"],
      answerFormat: "decimal",
      needsAnswerPath: true,
      rationalValue: answer,
      costTemplates: ct({ kind: "decimal-square", decimal }),
      technique: genericTechnique("小數平方", [`${formatDecimal(decimal)}² = ${formatDecimal(answer)}`]),
      kind,
      distractors: [answer + 0.01, answer - 0.01, answer + 0.1, Math.max(0, answer - 0.1)].map(formatDecimal),
    });
  }),
];

export const allTemplates: readonly QuestionTemplateDescriptor[] = [
  ...arithmeticTemplates,
  ...powersTemplates,
  ...fractionTemplates,
];

export function templateMatchesTags(
  template: QuestionTemplateDescriptor,
  tags: readonly string[],
  useSpecialtyTags = false,
): boolean {
  if (tags.length === 0) {
    return true;
  }

  const sample = template.generate({ difficulty: "medium", kind: "fill-in" });
  const matchTags =
    useSpecialtyTags && sample.specialtyTags
      ? sample.specialtyTags
      : useSpecialtyTags
        ? deriveSpecialtyTags(sample.tags)
        : sample.tags;
  return matchTags.some((tag) => tags.includes(tag));
}

export function filterTemplates(
  templates: readonly QuestionTemplateDescriptor[],
  tags?: readonly string[],
  options?: { useSpecialtyTags?: boolean },
): QuestionTemplateDescriptor[] {
  if (!tags || tags.length === 0) {
    return [...templates];
  }

  return templates.filter((template) => templateMatchesTags(template, tags, options?.useSpecialtyTags));
}

export function getQuestionTypesForTags(tags: readonly string[]): QuestionType[] {
  const types = new Set<QuestionType>();

  for (const template of allTemplates) {
    if (!templateMatchesTags(template, tags, true)) {
      continue;
    }

    const sample = template.generate({ difficulty: "medium", kind: "fill-in" });
    types.add(sample.type);
  }

  return [...types];
}
