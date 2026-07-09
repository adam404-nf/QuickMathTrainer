import { describe, expect, it } from "vitest";
import { resultForTemplate } from "./calculationTemplates";
import { decideZeroStep, isZeroStepResult } from "./nonZeroStep";
import { ZERO_STEP_ACCEPT_RATE } from "./selectionPolicy";

describe("isZeroStepResult", () => {
  it("detects numeric zero", () => {
    expect(isZeroStepResult("0")).toBe(true);
    expect(isZeroStepResult("0.0")).toBe(true);
    expect(isZeroStepResult("0/1")).toBe(true);
    expect(isZeroStepResult("1")).toBe(false);
    expect(isZeroStepResult("1/2")).toBe(false);
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
