import { describe, expect, it } from "vitest";
import { resultForTemplate, type CalculationTemplateSpec } from "./calculationTemplates";
import {
  decideZeroStep,
  hasAbsEvenPowerConflict,
  hasAdjacentCancel,
  hasTrivialCancelViolation,
  hasZeroOperand,
  isZeroStepResult,
} from "./nonZeroStep";
import { ZERO_STEP_ACCEPT_RATE } from "./selectionPolicy";

describe("isZeroStepResult", () => {
  it("detects numeric zero", () => {
    expect(isZeroStepResult("0")).toBe(true);
    expect(isZeroStepResult("0.0")).toBe(true);
    expect(isZeroStepResult("0/1")).toBe(true);
    expect(isZeroStepResult("1")).toBe(false);
    expect(isZeroStepResult("1/2")).toBe(false);
  });

  it("detects equal-fraction subtract as zero", () => {
    expect(
      isZeroStepResult(
        resultForTemplate({
          kind: "fraction-unlike-denom",
          left: { num: 2, den: 3 },
          right: { num: 2, den: 3 },
          op: "−",
        }),
      ),
    ).toBe(true);
  });
});

describe("hasZeroOperand", () => {
  it("rejects add/sub/mul with a zero operand", () => {
    expect(hasZeroOperand({ kind: "decimal-add", left: 0, right: 0.5 })).toBe(true);
    expect(hasZeroOperand({ kind: "integer-add", a: 0, b: 5 })).toBe(true);
    expect(hasZeroOperand({ kind: "integer-subtract", a: 5, b: 0 })).toBe(true);
    expect(hasZeroOperand({ kind: "integer-multiply", a: 0, b: 8 })).toBe(true);
    expect(hasZeroOperand({ kind: "decimal-multiply", decimal: 0, integer: 8 })).toBe(true);
    expect(hasZeroOperand({ kind: "integer-add", a: 3, b: 4 })).toBe(false);
    expect(hasZeroOperand({ kind: "integer-divide", dividend: 8, divisor: 2 })).toBe(false);
  });
});

describe("hasAdjacentCancel", () => {
  it("detects a+b then −b and a−b then +b", () => {
    expect(
      hasAdjacentCancel([
        { kind: "integer-add", a: 10, b: 5 },
        { kind: "integer-subtract", a: 15, b: 5 },
      ]),
    ).toBe(true);
    expect(
      hasAdjacentCancel([
        { kind: "integer-subtract", a: 10, b: 3 },
        { kind: "integer-add", a: 7, b: 3 },
      ]),
    ).toBe(true);
  });

  it("detects a×b then ÷b and a÷b then ×b", () => {
    expect(
      hasAdjacentCancel([
        { kind: "integer-multiply", a: 6, b: 4 },
        { kind: "integer-divide", dividend: 24, divisor: 4 },
      ]),
    ).toBe(true);
    expect(
      hasAdjacentCancel([
        { kind: "integer-divide", dividend: 20, divisor: 5 },
        { kind: "integer-multiply", a: 4, b: 5 },
      ]),
    ).toBe(true);
  });

  it("detects decimal add then subtract of the same amount", () => {
    expect(
      hasAdjacentCancel([
        { kind: "decimal-add", left: 10, right: 0.5 },
        { kind: "decimal-subtract", whole: 10.5, fraction: 0.5 },
      ]),
    ).toBe(true);
  });

  it("allows non-canceling adjacent steps", () => {
    expect(
      hasAdjacentCancel([
        { kind: "integer-add", a: 10, b: 5 },
        { kind: "integer-subtract", a: 15, b: 3 },
      ]),
    ).toBe(false);
  });
});

describe("hasAbsEvenPowerConflict", () => {
  it("flags absolute-value with square or fourth-power in the same question", () => {
    expect(
      hasAbsEvenPowerConflict([
        { kind: "absolute-value" },
        { kind: "square", n: 5 },
      ]),
    ).toBe(true);
    expect(
      hasAbsEvenPowerConflict([
        { kind: "absolute-value" },
        { kind: "fourth-power", n: 2 },
      ]),
    ).toBe(true);
    expect(hasAbsEvenPowerConflict([{ kind: "absolute-value" }, { kind: "cube", n: 3 }])).toBe(
      false,
    );
    expect(hasAbsEvenPowerConflict([{ kind: "square", n: 4 }])).toBe(false);
  });
});

describe("hasTrivialCancelViolation", () => {
  it("combines zero result, zero operand, adjacent cancel, and abs+even-power", () => {
    const zeroResult: CalculationTemplateSpec[] = [
      { kind: "integer-subtract", a: 5, b: 5 },
    ];
    const zeroOperand: CalculationTemplateSpec[] = [
      { kind: "decimal-add", left: 0, right: 0.5 },
    ];
    const cancel: CalculationTemplateSpec[] = [
      { kind: "integer-add", a: 1, b: 2 },
      { kind: "integer-subtract", a: 3, b: 2 },
    ];
    const absSquare: CalculationTemplateSpec[] = [
      { kind: "absolute-value" },
      { kind: "square", n: 7 },
    ];
    const ok: CalculationTemplateSpec[] = [
      { kind: "integer-add", a: 3, b: 4 },
      { kind: "integer-multiply", a: 7, b: 2 },
    ];

    expect(hasTrivialCancelViolation(zeroResult)).toBe(true);
    expect(hasTrivialCancelViolation(zeroOperand)).toBe(true);
    expect(hasTrivialCancelViolation(cancel)).toBe(true);
    expect(hasTrivialCancelViolation(absSquare)).toBe(true);
    expect(hasTrivialCancelViolation(ok)).toBe(false);
  });
});

describe("decideZeroStep", () => {
  it("rerolls numbers before accepting or rejecting template", () => {
    expect(
      decideZeroStep({ isZero: true, numberRerollCount: 0, maxNumberRerolls: 8, random: () => 0 }),
    ).toBe("reroll-numbers");
  });

  it("accepts zero with about 2% after rerolls exhausted", () => {
    expect(
      decideZeroStep({
        isZero: true,
        numberRerollCount: 8,
        maxNumberRerolls: 8,
        random: () => ZERO_STEP_ACCEPT_RATE - 1e-9,
      }),
    ).toBe("accept");
    expect(
      decideZeroStep({
        isZero: true,
        numberRerollCount: 8,
        maxNumberRerolls: 8,
        random: () => ZERO_STEP_ACCEPT_RATE + 1e-9,
      }),
    ).toBe("reject-template");
  });
});

describe("resultForTemplate export", () => {
  it("computes integer subtract zero", () => {
    expect(isZeroStepResult(resultForTemplate({ kind: "integer-subtract", a: 5, b: 5 }))).toBe(true);
  });
});
